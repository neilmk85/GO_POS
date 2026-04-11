package util

import (
	"fmt"
	"net/smtp"
)

type EmailConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
	FromName string
}

func SendEmail(cfg EmailConfig, to, subject, htmlBody string) error {
	// Construct From header
	from := fmt.Sprintf("%s <%s>", cfg.FromName, cfg.From)

	// Construct email message
	headers := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=\"UTF-8\"\r\n\r\n",
		from, to, subject,
	)
	message := headers + htmlBody

	// SMTP server address
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	// Send email
	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	err := smtp.SendMail(addr, auth, cfg.From, []string{to}, []byte(message))

	return err
}
