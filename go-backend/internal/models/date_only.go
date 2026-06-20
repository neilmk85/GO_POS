package models

import (
	"database/sql/driver"
	"fmt"
	"strings"
	"time"
)

// DateOnly is a string-backed type for MySQL DATE columns.
// When GORM scans a DATE column (which the MySQL driver returns as time.Time
// because parseTime=True is set in the DSN), it normalises the value to
// "YYYY-MM-DD" so the full ISO-8601 timestamp never leaks into the JSON
// response or back into a DB save.
type DateOnly string

// Scan implements sql.Scanner — called by GORM when reading from the DB.
func (d *DateOnly) Scan(value interface{}) error {
	switch v := value.(type) {
	case time.Time:
		*d = DateOnly(v.Format("2006-01-02"))
	case []byte:
		*d = DateOnly(stripTimeSuffix(string(v)))
	case string:
		*d = DateOnly(stripTimeSuffix(v))
	case nil:
		*d = ""
	default:
		return fmt.Errorf("DateOnly: cannot scan type %T", value)
	}
	return nil
}

// Value implements driver.Valuer — called by GORM when writing to the DB.
func (d DateOnly) Value() (driver.Value, error) {
	return string(d), nil
}

// stripTimeSuffix returns only the "YYYY-MM-DD" portion of a date/datetime
// string, handling values like "2026-04-16T00:00:00+05:30" or
// "2026-04-16 00:00:00 +0530 IST".
func stripTimeSuffix(s string) string {
	if idx := strings.IndexByte(s, 'T'); idx == 10 {
		return s[:10]
	}
	if idx := strings.IndexByte(s, ' '); idx == 10 {
		return s[:10]
	}
	return s
}
