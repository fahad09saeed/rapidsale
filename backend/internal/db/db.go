package db

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"rapidsale/backend/internal/config"
	"rapidsale/backend/internal/models"
)

// Connect opens the MySQL connection, retrying while the database starts up.
func Connect(cfg *config.Config) (*gorm.DB, error) {
	gcfg := &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Warn),
		NowFunc: func() time.Time { return time.Now().UTC() },
	}

	var (
		gdb *gorm.DB
		err error
	)
	for attempt := 1; attempt <= 30; attempt++ {
		gdb, err = gorm.Open(mysql.Open(cfg.DSN), gcfg)
		if err == nil {
			sqlDB, _ := gdb.DB()
			if err = sqlDB.Ping(); err == nil {
				sqlDB.SetMaxOpenConns(50)
				sqlDB.SetMaxIdleConns(10)
				sqlDB.SetConnMaxLifetime(30 * time.Minute)
				return gdb, nil
			}
		}
		log.Printf("database not ready (attempt %d/30): %v", attempt, err)
		time.Sleep(2 * time.Second)
	}
	return nil, fmt.Errorf("connect to database: %w", err)
}

// Migrate creates or updates all tables.
func Migrate(gdb *gorm.DB) error {
	return gdb.Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci").
		AutoMigrate(models.All()...)
}
