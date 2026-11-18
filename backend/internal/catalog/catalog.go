// Package catalog keeps an in-memory copy of the category and location trees.
// They change rarely (admin edits call Reload) and are read on almost every request.
package catalog

import (
	"sort"
	"sync"

	"gorm.io/gorm"

	"rapidsale/backend/internal/models"
)

type snapshot struct {
	cats     map[uint]*models.Category
	catSlug  map[string]*models.Category
	catRoots []*models.Category
	attrs    map[uint][]models.CategoryAttribute
	locs     map[uint]*models.Location
	locSlug  map[string]*models.Location
	locRoots []*models.Location
}

type Catalog struct {
	db *gorm.DB
	mu sync.RWMutex
	s  *snapshot
}

func New(db *gorm.DB) (*Catalog, error) {
	c := &Catalog{db: db}
	return c, c.Reload()
}

func (c *Catalog) Reload() error {
	var cats []models.Category
	if err := c.db.Order("sort_order, name").Find(&cats).Error; err != nil {
		return err
	}
	var attrs []models.CategoryAttribute
	if err := c.db.Order("sort_order, id").Find(&attrs).Error; err != nil {
		return err
	}
	var locs []models.Location
	if err := c.db.Order("sort_order, name").Find(&locs).Error; err != nil {
		return err
	}

	s := &snapshot{
		cats: map[uint]*models.Category{}, catSlug: map[string]*models.Category{},
		attrs: map[uint][]models.CategoryAttribute{},
		locs:  map[uint]*models.Location{}, locSlug: map[string]*models.Location{},
	}
	for i := range cats {
		cat := cats[i]
		s.cats[cat.ID] = &cat
		s.catSlug[cat.Slug] = &cat
	}
	for _, cat := range cats {
		node := s.cats[cat.ID]
		if node.ParentID != nil {
			if p := s.cats[*node.ParentID]; p != nil {
				p.Children = append(p.Children, node)
				continue
			}
		}
		s.catRoots = append(s.catRoots, node)
	}
	for _, a := range attrs {
		s.attrs[a.CategoryID] = append(s.attrs[a.CategoryID], a)
	}
	for i := range locs {
		l := locs[i]
		s.locs[l.ID] = &l
		s.locSlug[l.Slug] = &l
	}
	for _, l := range locs {
		node := s.locs[l.ID]
		if node.ParentID != nil {
			if p := s.locs[*node.ParentID]; p != nil {
				p.Children = append(p.Children, node)
				continue
			}
		}
		s.locRoots = append(s.locRoots, node)
	}

	c.mu.Lock()
	c.s = s
	c.mu.Unlock()
	return nil
}

func (c *Catalog) snap() *snapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.s
}

// ---- categories ----

// CategoryTree returns active root categories with their active children.
func (c *Catalog) CategoryTree(includeInactive bool) []*models.Category {
	var walk func([]*models.Category) []*models.Category
	walk = func(nodes []*models.Category) []*models.Category {
		out := make([]*models.Category, 0, len(nodes))
		for _, n := range nodes {
			if !n.IsActive && !includeInactive {
				continue
			}
			cp := *n
			cp.Attributes = nil
			cp.Children = walk(n.Children)
			out = append(out, &cp)
		}
		return out
	}
	return walk(c.snap().catRoots)
}

func (c *Catalog) CategoryByID(id uint) *models.Category    { return c.snap().cats[id] }
func (c *Catalog) CategoryBySlug(s string) *models.Category { return c.snap().catSlug[s] }

// CategoryPath returns the chain from the root to the category (inclusive), without children.
func (c *Catalog) CategoryPath(id uint) []models.Category {
	s := c.snap()
	var path []models.Category
	for cur := s.cats[id]; cur != nil; {
		cp := *cur
		cp.Children = nil
		path = append([]models.Category{cp}, path...)
		if cur.ParentID == nil {
			break
		}
		cur = s.cats[*cur.ParentID]
	}
	return path
}

// CategoryDescendantIDs returns the category ID and all descendant IDs.
func (c *Catalog) CategoryDescendantIDs(id uint) []uint {
	s := c.snap()
	root := s.cats[id]
	if root == nil {
		return nil
	}
	var ids []uint
	var walk func(*models.Category)
	walk = func(n *models.Category) {
		ids = append(ids, n.ID)
		for _, ch := range n.Children {
			walk(ch)
		}
	}
	walk(root)
	return ids
}

// EffectiveAttributes returns attributes defined on the category and all its ancestors.
func (c *Catalog) EffectiveAttributes(id uint) []models.CategoryAttribute {
	s := c.snap()
	var out []models.CategoryAttribute
	seen := map[string]bool{}
	for _, cat := range c.CategoryPath(id) {
		for _, a := range s.attrs[cat.ID] {
			if !seen[a.Key] {
				seen[a.Key] = true
				out = append(out, a)
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].SortOrder < out[j].SortOrder })
	return out
}

// ---- locations ----

func (c *Catalog) LocationTree() []*models.Location            { return c.snap().locRoots }
func (c *Catalog) LocationByID(id uint) *models.Location       { return c.snap().locs[id] }
func (c *Catalog) LocationBySlug(slug string) *models.Location { return c.snap().locSlug[slug] }

func (c *Catalog) LocationPath(id uint) []models.Location {
	s := c.snap()
	var path []models.Location
	for cur := s.locs[id]; cur != nil; {
		cp := *cur
		cp.Children = nil
		path = append([]models.Location{cp}, path...)
		if cur.ParentID == nil {
			break
		}
		cur = s.locs[*cur.ParentID]
	}
	return path
}

func (c *Catalog) LocationDescendantIDs(id uint) []uint {
	s := c.snap()
	root := s.locs[id]
	if root == nil {
		return nil
	}
	var ids []uint
	var walk func(*models.Location)
	walk = func(n *models.Location) {
		ids = append(ids, n.ID)
		for _, ch := range n.Children {
			walk(ch)
		}
	}
	walk(root)
	return ids
}
