package seed

type locSeed struct {
	Name   string
	Cities []citySeed
}

type citySeed struct {
	Name  string
	Areas []string
}

func cities(names ...string) []citySeed {
	out := make([]citySeed, len(names))
	for i, n := range names {
		out[i] = citySeed{Name: n}
	}
	return out
}

// Locations covers all provinces/territories of Pakistan, major cities and popular areas.
var Locations = []locSeed{
	{Name: "Punjab", Cities: append([]citySeed{
		{Name: "Lahore", Areas: []string{"DHA Defence", "Gulberg", "Johar Town", "Bahria Town", "Model Town", "Iqbal Town",
			"Wapda Town", "Cantt", "Valencia", "Township", "Faisal Town", "Garden Town", "Allama Iqbal Town", "Samanabad",
			"Shadman", "Raiwind Road", "Lake City", "Askari", "Gulshan-e-Ravi", "Shahdara"}},
		{Name: "Rawalpindi", Areas: []string{"Bahria Town", "DHA", "Saddar", "Satellite Town", "Chaklala", "Westridge",
			"Gulraiz", "Adiala Road", "Peshawar Road", "Askari"}},
		{Name: "Faisalabad", Areas: []string{"Madina Town", "Peoples Colony", "Susan Road", "Canal Road", "D Ground",
			"Gulberg", "Satiana Road", "Jaranwala Road"}},
		{Name: "Multan", Areas: []string{"Bosan Road", "Cantt", "Gulgasht Colony", "Shah Rukn-e-Alam", "DHA"}},
		{Name: "Gujranwala", Areas: []string{"Satellite Town", "Model Town", "DC Road", "Peoples Colony"}},
	}, cities("Sialkot", "Bahawalpur", "Sargodha", "Sheikhupura", "Jhang", "Rahim Yar Khan", "Gujrat", "Kasur",
		"Sahiwal", "Okara", "Wah Cantt", "Dera Ghazi Khan", "Chiniot", "Kamoke", "Mandi Bahauddin", "Jhelum",
		"Sadiqabad", "Khanewal", "Hafizabad", "Muzaffargarh", "Khanpur", "Attock", "Chakwal", "Mianwali", "Vehari",
		"Burewala", "Bahawalnagar", "Pakpattan", "Narowal", "Toba Tek Singh", "Murree", "Taxila", "Lodhran",
		"Layyah", "Bhakkar", "Khushab", "Rajanpur")...)},
	{Name: "Sindh", Cities: append([]citySeed{
		{Name: "Karachi", Areas: []string{"DHA Defence", "Clifton", "Gulshan-e-Iqbal", "Gulistan-e-Jauhar", "North Nazimabad",
			"PECHS", "Bahria Town Karachi", "Scheme 33", "Malir", "Korangi", "Saddar", "Nazimabad", "Federal B Area",
			"North Karachi", "Shah Faisal Colony", "Bahadurabad", "Tariq Road", "Garden", "Lyari", "Orangi Town",
			"Landhi", "Gulberg", "Surjani Town", "Kemari"}},
		{Name: "Hyderabad", Areas: []string{"Latifabad", "Qasimabad", "Hyderabad Cantt", "Auto Bhan Road", "Citizen Colony"}},
	}, cities("Sukkur", "Larkana", "Nawabshah", "Mirpur Khas", "Jacobabad", "Shikarpur", "Khairpur", "Dadu",
		"Thatta", "Badin", "Tando Adam", "Tando Allahyar", "Umerkot", "Ghotki", "Kotri", "Sanghar")...)},
	{Name: "Khyber Pakhtunkhwa", Cities: append([]citySeed{
		{Name: "Peshawar", Areas: []string{"Hayatabad", "University Town", "Saddar", "Gulbahar", "Warsak Road",
			"Ring Road", "Regi Model Town", "DHA Peshawar"}},
	}, cities("Mardan", "Abbottabad", "Swat", "Mingora", "Kohat", "Dera Ismail Khan", "Mansehra", "Nowshera",
		"Charsadda", "Swabi", "Bannu", "Haripur", "Chitral", "Karak", "Lakki Marwat", "Battagram", "Malakand", "Dir")...)},
	{Name: "Balochistan", Cities: append([]citySeed{
		{Name: "Quetta", Areas: []string{"Jinnah Town", "Satellite Town", "Samungli Road", "Cantt", "Airport Road"}},
	}, cities("Gwadar", "Turbat", "Khuzdar", "Chaman", "Hub", "Sibi", "Zhob", "Loralai", "Nushki", "Kharan", "Dera Murad Jamali")...)},
	{Name: "Islamabad Capital Territory", Cities: []citySeed{
		{Name: "Islamabad", Areas: []string{"F-6", "F-7", "F-8", "F-10", "F-11", "E-7", "E-11", "G-6", "G-9", "G-10",
			"G-11", "G-13", "G-14", "I-8", "I-10", "DHA Islamabad", "Bahria Town Islamabad", "B-17", "Bani Gala",
			"Gulberg Greens", "PWD Housing Scheme", "Ghauri Town", "Soan Garden", "D-12", "Blue Area"}},
	}},
	{Name: "Azad Kashmir", Cities: cities("Muzaffarabad", "Mirpur", "Rawalakot", "Kotli", "Bhimber", "Bagh", "Neelum")},
	{Name: "Gilgit-Baltistan", Cities: cities("Gilgit", "Skardu", "Hunza", "Ghizer", "Chilas", "Khaplu", "Astore")},
}
