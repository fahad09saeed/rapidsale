// Command seed migrates the database and seeds roles, permissions, the superadmin,
// categories and locations. Pass -demo to add demo users and listings.
package main

import (
	"flag"
	"log"

	"rapidsale/backend/internal/config"
	"rapidsale/backend/internal/db"
	"rapidsale/backend/internal/seed"
)

func main() {
	demo := flag.Bool("demo", false, "also create demo users and listings")
	flag.Parse()

	cfg := config.Load()
	gdb, err := db.Connect(cfg)
	if err != nil {
		log.Fatal(err)
	}
	if err := db.Migrate(gdb); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := seed.Run(gdb, cfg, *demo); err != nil {
		log.Fatal(err)
	}
	log.Println("seeding complete")
}
