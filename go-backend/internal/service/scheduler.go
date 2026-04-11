package service

import (
	"log/slog"
	"time"

	"gorm.io/gorm"
)

// StartScheduler starts all background scheduled jobs
func StartScheduler(db *gorm.DB) {
	slog.Info("[Scheduler] Starting background jobs")

	// Schedule recurring expense generation at 6:00 AM daily
	runDaily(6, 0, func() {
		generateDueRecurringExpenses(db)
	})

	slog.Info("[Scheduler] Recurring expense scheduler started", "time", "06:00")
}

// runDaily executes a function once per day at the specified time
func runDaily(hour, minute int, fn func()) {
	go func() {
		for {
			now := time.Now()

			// Calculate next run time
			next := time.Date(
				now.Year(),
				now.Month(),
				now.Day(),
				hour,
				minute,
				0,
				0,
				now.Location(),
			)

			// If the time has already passed today, schedule for tomorrow
			if next.Before(now) {
				next = next.AddDate(0, 0, 1)
			}

			// Calculate duration until next run
			duration := next.Sub(now)

			slog.Debug("[Scheduler] Next run scheduled", "duration", duration.String())

			// Wait until the next run time
			time.Sleep(duration)

			// Execute the function
			fn()

			// Reset to the next day
			next = next.AddDate(0, 0, 1)
			duration = next.Sub(time.Now())
			time.Sleep(duration)
		}
	}()
}

// generateDueRecurringExpenses generates expenses for recurring expense rules
// that are due based on their recurrence interval
func generateDueRecurringExpenses(db *gorm.DB) {
	slog.Info("[Scheduler] Running recurring expense generation")

	expSvc := &ExpenseService{db: db}
	count, err := expSvc.GenerateRecurringExpenses()
	if err != nil {
		slog.Error("[Scheduler] Error generating recurring expenses", "error", err)
	} else if count > 0 {
		slog.Info("[Scheduler] Generated recurring expenses", "count", count)
	}

	slog.Info("[Scheduler] Recurring expense generation completed")
}
