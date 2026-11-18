package seed

import "rapidsale/backend/internal/models"

type catSeed struct {
	Name     string
	Icon     string
	Attrs    []models.CategoryAttribute
	Children []catSeed
}

func sel(key, label string, required bool, opts ...string) models.CategoryAttribute {
	return models.CategoryAttribute{Key: key, Label: label, Type: models.AttrSelect, Options: opts, Required: required, Filterable: true}
}
func num(key, label, unit string, required bool) models.CategoryAttribute {
	return models.CategoryAttribute{Key: key, Label: label, Type: models.AttrNumber, Unit: unit, Required: required, Filterable: true}
}
func txt(key, label string, required bool) models.CategoryAttribute {
	return models.CategoryAttribute{Key: key, Label: label, Type: models.AttrText, Required: required}
}
func boolean(key, label string) models.CategoryAttribute {
	return models.CategoryAttribute{Key: key, Label: label, Type: models.AttrBoolean, Filterable: true}
}

func leaves(names ...string) []catSeed {
	out := make([]catSeed, len(names))
	for i, n := range names {
		out[i] = catSeed{Name: n}
	}
	return out
}

var (
	phoneBrands = []string{"Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "Infinix", "Tecno", "Realme", "OnePlus",
		"Google", "Huawei", "Honor", "Nokia", "Motorola", "Itel", "Sony", "QMobile", "Other"}
	storage  = []string{"8 GB", "16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"}
	ram      = []string{"1 GB", "2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB"}
	carMakes = []string{"Toyota", "Honda", "Suzuki", "Daihatsu", "Nissan", "Hyundai", "KIA", "Changan", "MG", "Haval",
		"Proton", "DFSK", "Mitsubishi", "Mazda", "Mercedes Benz", "BMW", "Audi", "Lexus", "Chevrolet", "FAW", "Prince", "BAIC", "Other"}
	bikeMakes = []string{"Honda", "Yamaha", "Suzuki", "United", "Road Prince", "Unique", "Super Power", "Super Star",
		"Hi Speed", "Crown", "Ravi", "Metro", "Kawasaki", "Benelli", "Other"}
	fuel         = []string{"Petrol", "Diesel", "Hybrid", "Electric", "CNG", "LPG"}
	transmission = []string{"Manual", "Automatic"}
	areaUnits    = []string{"Marla", "Kanal", "Sq. Ft.", "Sq. Yd.", "Acre"}
	furnished    = []string{"Furnished", "Unfurnished", "Semi-Furnished"}
	bedrooms     = []string{"Studio", "1", "2", "3", "4", "5", "6", "7+"}
	bathrooms    = []string{"1", "2", "3", "4", "5", "6", "7+"}
	jobTypes     = []string{"Full-time", "Part-time", "Contract", "Temporary", "Internship", "Freelance"}
	careerLevel  = []string{"Entry Level", "Experienced Professional", "Manager", "Senior Manager", "Executive"}
	gender       = []string{"Men", "Women", "Boys", "Girls", "Unisex"}
)

func phoneAttrs() []models.CategoryAttribute {
	return []models.CategoryAttribute{
		sel("brand", "Brand", true, phoneBrands...),
		txt("model", "Model", false),
		sel("storage", "Storage", false, storage...),
		sel("ram", "RAM", false, ram...),
		sel("pta_status", "PTA Status", false, "PTA Approved", "Non PTA", "JV / Patched"),
	}
}

func propertyAttrs(withRooms bool) []models.CategoryAttribute {
	a := []models.CategoryAttribute{
		num("area", "Area", "", true),
		sel("area_unit", "Area Unit", true, areaUnits...),
	}
	if withRooms {
		a = append(a,
			sel("bedrooms", "Bedrooms", false, bedrooms...),
			sel("bathrooms", "Bathrooms", false, bathrooms...),
			sel("furnished", "Furnishing", false, furnished...),
			txt("floor", "Floor Level", false),
		)
	}
	return a
}

func landAttrs() []models.CategoryAttribute {
	return []models.CategoryAttribute{
		sel("land_type", "Type", true, "Residential Plot", "Commercial Plot", "Agricultural Land", "Industrial Land", "Plot File", "Plot Form"),
		num("area", "Area", "", true),
		sel("area_unit", "Area Unit", true, areaUnits...),
		boolean("corner", "Corner"),
		boolean("possession", "Possession Available"),
	}
}

func commercialAttrs() []models.CategoryAttribute {
	return []models.CategoryAttribute{
		sel("property_type", "Type", true, "Shop", "Office", "Warehouse", "Factory", "Building", "Other"),
		num("area", "Area", "", true),
		sel("area_unit", "Area Unit", true, areaUnits...),
		sel("furnished", "Furnishing", false, furnished...),
	}
}

// Categories mirrors the structure of large Pakistani classifieds marketplaces.
var Categories = []catSeed{
	{Name: "Mobiles", Icon: "smartphone", Children: []catSeed{
		{Name: "Mobile Phones", Attrs: phoneAttrs()},
		{Name: "Tablets", Attrs: []models.CategoryAttribute{
			sel("brand", "Brand", true, "Apple", "Samsung", "Lenovo", "Huawei", "Xiaomi", "Danny", "Other"),
			txt("model", "Model", false), sel("storage", "Storage", false, storage...),
		}},
		{Name: "Smart Watches", Attrs: []models.CategoryAttribute{
			sel("brand", "Brand", false, "Apple", "Samsung", "Huawei", "Xiaomi", "Amazfit", "Ronin", "Zero", "Other"),
		}},
		{Name: "Accessories", Attrs: []models.CategoryAttribute{
			sel("type", "Type", true, "Chargers", "Cables", "Covers & Cases", "Headphones", "Power Banks",
				"Screens", "Screen Protectors", "Memory Cards", "Other"),
		}},
	}},
	{Name: "Vehicles", Icon: "car", Children: []catSeed{
		{Name: "Cars", Attrs: []models.CategoryAttribute{
			sel("make", "Make", true, carMakes...),
			txt("model", "Model", true),
			num("year", "Year", "", true),
			num("km_driven", "KMs Driven", "km", true),
			sel("fuel", "Fuel", true, fuel...),
			sel("transmission", "Transmission", false, transmission...),
			sel("body_type", "Body Type", false, "Sedan", "Hatchback", "SUV", "Crossover", "Mini Van", "Pickup", "Coupe", "Convertible", "Other"),
			txt("registered_in", "Registered In", false),
			txt("color", "Color", false),
			sel("assembly", "Assembly", false, "Local", "Imported"),
		}},
		{Name: "Cars on Installments", Attrs: []models.CategoryAttribute{
			sel("make", "Make", true, carMakes...), txt("model", "Model", true), num("year", "Year", "", false),
			num("down_payment", "Down Payment", "PKR", false), num("monthly_installment", "Monthly Installment", "PKR", false),
		}},
		{Name: "Car Accessories", Attrs: []models.CategoryAttribute{
			sel("type", "Type", false, "Interior", "Exterior", "Audio & Multimedia", "Tyres & Rims", "Lights", "Other"),
		}},
		{Name: "Spare Parts", Attrs: []models.CategoryAttribute{
			sel("type", "Type", false, "Engine", "Body Parts", "Brakes", "Suspension", "Electrical", "Batteries", "Filters", "Other"),
		}},
		{Name: "Buses, Vans & Trucks", Attrs: []models.CategoryAttribute{
			txt("make", "Make", false), num("year", "Year", "", false), num("km_driven", "KMs Driven", "km", false),
			sel("fuel", "Fuel", false, fuel...),
		}},
		{Name: "Rickshaw & Chingchi", Attrs: []models.CategoryAttribute{num("year", "Year", "", false)}},
		{Name: "Tractors & Trailers", Attrs: []models.CategoryAttribute{
			sel("make", "Make", false, "Massey Ferguson", "Fiat", "New Holland", "Belarus", "Other"), num("year", "Year", "", false),
		}},
		{Name: "Boats"},
		{Name: "Other Vehicles"},
	}},
	{Name: "Property for Sale", Icon: "home", Children: []catSeed{
		{Name: "Land & Plots", Attrs: landAttrs()},
		{Name: "Houses", Attrs: propertyAttrs(true)},
		{Name: "Apartments & Flats", Attrs: propertyAttrs(true)},
		{Name: "Shops - Offices - Commercial Space", Attrs: commercialAttrs()},
		{Name: "Portions & Floors", Attrs: propertyAttrs(true)},
	}},
	{Name: "Property for Rent", Icon: "key", Children: []catSeed{
		{Name: "Houses", Attrs: propertyAttrs(true)},
		{Name: "Apartments & Flats", Attrs: propertyAttrs(true)},
		{Name: "Portions & Floors", Attrs: propertyAttrs(true)},
		{Name: "Shops - Offices - Commercial Space", Attrs: commercialAttrs()},
		{Name: "Rooms", Attrs: []models.CategoryAttribute{sel("furnished", "Furnishing", false, furnished...)}},
		{Name: "Roommates & Paying Guests", Attrs: []models.CategoryAttribute{sel("gender", "Preferred Gender", false, "Male", "Female", "Any")}},
		{Name: "Vacation Rentals - Guest Houses", Attrs: []models.CategoryAttribute{sel("bedrooms", "Bedrooms", false, bedrooms...)}},
		{Name: "Land & Plots", Attrs: landAttrs()},
	}},
	{Name: "Electronics & Home Appliances", Icon: "tv", Children: []catSeed{
		{Name: "Computers & Accessories", Attrs: []models.CategoryAttribute{
			sel("type", "Type", true, "Laptops", "Desktops", "Monitors", "Keyboards & Mice", "Printers & Scanners",
				"Storage", "Networking", "Computer Components", "Other"),
			sel("brand", "Brand", false, "Apple", "Dell", "HP", "Lenovo", "Acer", "Asus", "MSI", "Microsoft", "Samsung", "Other"),
			txt("processor", "Processor", false), sel("ram", "RAM", false, "4 GB", "8 GB", "16 GB", "32 GB", "64 GB"),
		}},
		{Name: "TV - Video - Audio", Attrs: []models.CategoryAttribute{
			sel("type", "Type", true, "LED TV", "Smart TV", "Home Theater", "Speakers", "Headphones", "Projectors", "Other"),
			sel("brand", "Brand", false, "Samsung", "LG", "Sony", "TCL", "Haier", "Orient", "Changhong Ruba", "Other"),
		}},
		{Name: "Cameras & Accessories", Attrs: []models.CategoryAttribute{
			sel("type", "Type", false, "DSLR", "Mirrorless", "Point & Shoot", "Lenses", "CCTV", "Drones", "Other"),
			sel("brand", "Brand", false, "Canon", "Nikon", "Sony", "Fujifilm", "DJI", "GoPro", "Other"),
		}},
		{Name: "Games & Entertainment", Attrs: []models.CategoryAttribute{
			sel("type", "Type", false, "Consoles", "Video Games", "Controllers", "VR", "Other"),
		}},
		{Name: "Generators, UPS & Power Solutions", Attrs: []models.CategoryAttribute{
			sel("type", "Type", false, "Generators", "UPS", "Solar Panels", "Inverters", "Batteries", "Stabilizers", "Other"),
		}},
		{Name: "Kitchen Appliances", Attrs: []models.CategoryAttribute{
			sel("type", "Type", false, "Microwaves & Ovens", "Juicers & Blenders", "Cookers", "Water Dispensers", "Other"),
		}},
		{Name: "AC & Coolers", Attrs: []models.CategoryAttribute{
			sel("type", "Type", false, "Split AC", "Window AC", "Portable AC", "Air Coolers", "Other"),
			sel("brand", "Brand", false, "Gree", "Haier", "Dawlance", "Orient", "PEL", "Kenwood", "TCL", "Other"),
			sel("inverter", "Inverter", false, "Inverter", "Non-Inverter"),
		}},
		{Name: "Fridges & Freezers", Attrs: []models.CategoryAttribute{
			sel("brand", "Brand", false, "Dawlance", "Haier", "PEL", "Orient", "Gree", "Samsung", "LG", "Other"),
		}},
		{Name: "Washing Machines & Dryers", Attrs: []models.CategoryAttribute{
			sel("type", "Type", false, "Automatic", "Semi-Automatic", "Dryer"),
		}},
		{Name: "Other Home Appliances"},
	}},
	{Name: "Bikes", Icon: "bike", Children: []catSeed{
		{Name: "Motorcycles", Attrs: []models.CategoryAttribute{
			sel("make", "Make", true, bikeMakes...), txt("model", "Model", false), num("year", "Year", "", true),
			num("km_driven", "KMs Driven", "km", false), sel("engine", "Engine", false, "50cc", "70cc", "100cc", "110cc", "125cc", "150cc", "200cc+", "Electric"),
		}},
		{Name: "Scooters", Attrs: []models.CategoryAttribute{num("year", "Year", "", false)}},
		{Name: "Bicycles", Attrs: []models.CategoryAttribute{sel("type", "Type", false, "Road", "Mountain", "Hybrid", "Kids", "Other")}},
		{Name: "ATV & Quads"},
		{Name: "Spare Parts"},
	}},
	{Name: "Business, Industrial & Agriculture", Icon: "briefcase", Children: leaves(
		"Business for Sale", "Food & Restaurants", "Trade & Industrial", "Construction & Heavy Machinery",
		"Agriculture", "Medical & Pharma", "Other Business & Industry")},
	{Name: "Services", Icon: "wrench", Children: leaves(
		"Education & Classes", "Travel & Visa", "Car Rental", "Drivers & Taxi", "Web Development",
		"Electronics & Computer Repair", "Event Services", "Health & Beauty", "Maids & Domestic Help",
		"Movers & Packers", "Home & Office Repair", "Catering & Restaurant", "Farm & Fresh Food", "Other Services")},
	{Name: "Jobs", Icon: "badge", Attrs: []models.CategoryAttribute{
		sel("job_type", "Position Type", true, jobTypes...),
		sel("career_level", "Career Level", false, careerLevel...),
		num("salary_from", "Salary From", "PKR", false),
		num("salary_to", "Salary To", "PKR", false),
		sel("salary_period", "Salary Period", false, "Monthly", "Weekly", "Daily", "Hourly", "Yearly"),
		txt("company", "Company Name", false),
	}, Children: leaves(
		"Online", "Marketing", "Advertising & PR", "Education", "Customer Service", "Sales", "IT & Networking",
		"Hotels & Tourism", "Clerical & Administration", "Human Resources", "Accounting & Finance",
		"Manufacturing", "Medical", "Domestic Staff", "Part Time", "Other Jobs")},
	{Name: "Animals", Icon: "paw", Attrs: []models.CategoryAttribute{
		txt("breed", "Breed", false), txt("age", "Age", false), sel("sex", "Sex", false, "Male", "Female", "Pair"),
	}, Children: leaves(
		"Fish & Aquariums", "Birds", "Hens & Aseel", "Cats", "Dogs", "Livestock", "Horses",
		"Pet Food & Accessories", "Other Animals")},
	{Name: "Furniture & Home Decor", Icon: "sofa", Children: leaves(
		"Sofa & Chairs", "Beds & Wardrobes", "Tables & Dining", "Home Decoration", "Garden & Outdoor",
		"Painting & Mirrors", "Rugs & Carpets", "Curtains & Blinds", "Office Furniture", "Other Household Items")},
	{Name: "Fashion & Beauty", Icon: "shirt", Attrs: []models.CategoryAttribute{
		sel("gender", "For", false, gender...),
	}, Children: leaves(
		"Clothes", "Lawn & Pret", "Couture", "Wedding", "Footwear", "Watches", "Jewellery", "Accessories",
		"Make Up", "Skin & Hair", "Other Fashion")},
	{Name: "Books, Sports & Hobbies", Icon: "book", Children: leaves(
		"Books & Magazines", "Musical Instruments", "Sports Equipment", "Gym & Fitness", "Other Hobbies")},
	{Name: "Kids", Icon: "baby", Children: leaves(
		"Kids Furniture", "Toys", "Prams & Walkers", "Swings & Slides", "Kids Bikes", "Kids Accessories")},
}
