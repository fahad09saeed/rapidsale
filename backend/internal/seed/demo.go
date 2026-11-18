package seed

import (
	"fmt"
	"time"

	"gorm.io/gorm"

	"rapidsale/backend/internal/auth"
	"rapidsale/backend/internal/config"
	"rapidsale/backend/internal/models"
)

type demoListing struct {
	category, location, title, desc string
	price                           int64
	condition                       string
	attrs                           map[string]any
	image                           string
}

var demoListings = []demoListing{
	{"mobile-phones", "lahore-dha-defence", "iPhone 15 Pro Max 256GB PTA Approved",
		"Excellent condition iPhone 15 Pro Max, 256GB, natural titanium. Battery health 92%. Complete box with original cable. No scratches, always used with cover.",
		385000, "used", map[string]any{"brand": "Apple", "model": "15 Pro Max", "storage": "256 GB", "pta_status": "PTA Approved"},
		"https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800"},
	{"mobile-phones", "karachi-clifton", "Samsung Galaxy S24 Ultra 12/512",
		"Samsung S24 Ultra in titanium black, 12GB RAM, 512GB storage, dual SIM official PTA. 10 months warranty remaining, comes with box and charger.",
		340000, "used", map[string]any{"brand": "Samsung", "model": "S24 Ultra", "storage": "512 GB", "ram": "12 GB", "pta_status": "PTA Approved"},
		"https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800"},
	{"cars", "islamabad-f-10", "Toyota Corolla Altis Grande 1.8 2021",
		"First owner, Islamabad registered, bumper to bumper genuine. Done 45,000 km, all services from Toyota dealership. Token taxes paid till date.",
		6950000, "used", map[string]any{"make": "Toyota", "model": "Corolla Altis Grande", "year": 2021.0, "km_driven": 45000.0,
			"fuel": "Petrol", "transmission": "Automatic", "body_type": "Sedan", "registered_in": "Islamabad", "assembly": "Local"},
		"https://images.unsplash.com/photo-1623869675781-80aa31012a5a?w=800"},
	{"cars", "lahore-johar-town", "Honda Civic Oriel 2019 Turbo",
		"Honda Civic 1.5 VTEC turbo Oriel, Lahore number, 70,000 km driven. Minor touch-ups, engine and suspension perfect. Serious buyers only.",
		5850000, "used", map[string]any{"make": "Honda", "model": "Civic Oriel", "year": 2019.0, "km_driven": 70000.0,
			"fuel": "Petrol", "transmission": "Automatic", "body_type": "Sedan", "registered_in": "Lahore"},
		"https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=800"},
	{"motorcycles", "rawalpindi-saddar", "Honda CG 125 2023 Model",
		"Honda CG125 2023 model, Rawalpindi registered, done 8,000 km only. Neat and clean, documents complete. Price slightly negotiable.",
		235000, "used", map[string]any{"make": "Honda", "model": "CG 125", "year": 2023.0, "km_driven": 8000.0, "engine": "125cc"},
		"https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800"},
	{"houses", "karachi-bahria-town-karachi", "10 Marla Brand New House for Sale",
		"Brand new 10 marla double storey house in a prime precinct. 5 bedrooms with attached baths, modern kitchen, servant quarter and car porch.",
		32500000, "new", map[string]any{"area": 10.0, "area_unit": "Marla", "bedrooms": "5", "bathrooms": "6", "furnished": "Unfurnished"},
		"https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"},
	{"property-for-rent-apartments-flats", "islamabad-e-11", "2 Bed Furnished Apartment for Rent",
		"Fully furnished 2 bedroom apartment on the 4th floor with lift, backup generator and covered parking. Ideal for small families or professionals.",
		120000, "", map[string]any{"area": 1100.0, "area_unit": "Sq. Ft.", "bedrooms": "2", "bathrooms": "2", "furnished": "Furnished", "floor": "4th"},
		"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"},
	{"computers-accessories", "lahore-gulberg", "MacBook Air M2 13-inch 8/256",
		"Apple MacBook Air M2, midnight colour, 8GB RAM and 256GB SSD. Battery cycle count 61. Like new with box and charger.",
		255000, "used", map[string]any{"type": "Laptops", "brand": "Apple", "processor": "Apple M2", "ram": "8 GB"},
		"https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800"},
	{"sofa-chairs", "faisalabad", "7 Seater Sofa Set Solid Wood",
		"Solid sheesham wood 7 seater sofa set with velvet fabric. Two years used, very good condition. Pickup from Faisalabad.",
		95000, "used", map[string]any{},
		"https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800"},
	{"it-networking", "karachi-pechs", "Junior React Developer Needed",
		"We are hiring a junior React / Next.js developer for our Karachi office. 1+ year experience required. Market competitive salary with annual bonus.",
		0, "", map[string]any{"job_type": "Full-time", "career_level": "Entry Level", "salary_from": 80000.0, "salary_to": 120000.0,
			"salary_period": "Monthly", "company": "Example Tech"},
		""},
	{"cats", "lahore-model-town", "Persian Kittens Triple Coat",
		"Healthy, vaccinated and litter trained Persian kittens, 3 months old. Triple coat, very playful. Delivery available in Lahore.",
		25000, "", map[string]any{"breed": "Persian", "age": "3 months", "sex": "Pair"},
		"https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800"},
	{"ac-coolers", "multan", "Gree 1.5 Ton DC Inverter AC",
		"Gree 1.5 ton DC inverter, heat and cool, used for one season only. Excellent cooling, low electricity bill. Installation not included.",
		110000, "used", map[string]any{"type": "Split AC", "brand": "Gree", "inverter": "Inverter"},
		"https://images.unsplash.com/photo-1631545806609-35d4ae440431?w=800"},
}

func seedDemo(db *gorm.DB, cfg *config.Config) error {
	var role models.Role
	if err := db.Where("name = ?", models.RoleUser).First(&role).Error; err != nil {
		return err
	}
	hash, _ := auth.HashPassword("Password123!")
	now := time.Now()
	sellers := []models.User{}
	for i, name := range []string{"Ali Raza", "Ayesha Khan", "Usman Tariq"} {
		email := fmt.Sprintf("demo%d@rapidsale.local", i+1)
		phone := fmt.Sprintf("+92300000000%d", i+1)
		u := models.User{Email: &email}
		if err := db.Where("email = ?", email).Attrs(models.User{
			Name: name, Phone: &phone, PasswordHash: hash, RoleID: role.ID, Status: models.UserActive,
			EmailVerifiedAt: &now, PhoneVerifiedAt: &now,
		}).FirstOrCreate(&u).Error; err != nil {
			return err
		}
		sellers = append(sellers, u)
	}

	for i, d := range demoListings {
		var count int64
		db.Model(&models.Listing{}).Where("title = ?", d.title).Count(&count)
		if count > 0 {
			continue
		}
		var cat models.Category
		if err := db.Where("slug = ?", d.category).First(&cat).Error; err != nil {
			return fmt.Errorf("demo category %q: %w", d.category, err)
		}
		var loc models.Location
		if err := db.Where("slug = ?", d.location).First(&loc).Error; err != nil {
			return fmt.Errorf("demo location %q: %w", d.location, err)
		}
		seller := sellers[i%len(sellers)]
		exp := now.AddDate(0, 0, cfg.ListingTTLDays)
		l := models.Listing{
			UserID: seller.ID, CategoryID: cat.ID, LocationID: loc.ID, Title: d.title, Description: d.desc,
			Price: d.price, Negotiable: i%2 == 0, Condition: d.condition, Status: models.ListingActive, Attributes: d.attrs,
			ContactName: seller.Name, ContactPhone: *seller.Phone, ShowPhone: true, IsFeatured: i < 4, ExpiresAt: &exp,
		}
		if d.image != "" {
			l.Images = []models.ListingImage{{URL: d.image}}
		}
		if err := db.Create(&l).Error; err != nil {
			return err
		}
	}
	return nil
}
