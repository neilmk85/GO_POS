package database

import (
	"log/slog"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(dsn string, isDevelopment bool) (*gorm.DB, error) {
	var logLevel logger.LogLevel
	if isDevelopment {
		logLevel = logger.Info
	} else {
		logLevel = logger.Error
	}

	gormLogger := logger.Default.
		LogMode(logLevel)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		slog.Error("failed to get database instance", "error", err)
		return nil, err
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	slog.Info("connected to MySQL database")
	return db, nil
}
