-- NexaFlow Database Initialization Script

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(100),
  address_country VARCHAR(100),
  address_zip VARCHAR(20),
  security_question TEXT,
  security_answer_hash TEXT,
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed demo accounts (password: password123, answer: fluffy)
INSERT INTO users (
  username, email, password_hash, first_name, last_name,
  address_street, address_city, address_state, address_country, address_zip,
  security_question, security_answer_hash, totp_enabled
) VALUES
(
  'john_doe',
  'john@example.com',
  '$2a$10$p.tnGGUbtDnh80/pPRP0mOOlqUkAc3xKIfa3dwmNJ6tdt7f70hhOO',
  'John',
  'Doe',
  '123 Main Street',
  'New York',
  'NY',
  'USA',
  '10001',
  'What was the name of your first pet?',
  '$2a$10$KsTINbEvSpBY9Itpe3jGz.aU5QASa41OWlddGYFggxz2.KqQoWS0.',
  FALSE
),
(
  'jane_smith',
  'jane@example.com',
  '$2a$10$p.tnGGUbtDnh80/pPRP0mOOlqUkAc3xKIfa3dwmNJ6tdt7f70hhOO',
  'Jane',
  'Smith',
  '456 Elm Street',
  'San Francisco',
  'CA',
  'USA',
  '94101',
  'What was the name of your first pet?',
  '$2a$10$KsTINbEvSpBY9Itpe3jGz.aU5QASa41OWlddGYFggxz2.KqQoWS0.',
  FALSE
),
(
  'bob_wilson',
  'bob@example.com',
  '$2a$10$p.tnGGUbtDnh80/pPRP0mOOlqUkAc3xKIfa3dwmNJ6tdt7f70hhOO',
  'Bob',
  'Wilson',
  '789 Oak Avenue',
  'Austin',
  'TX',
  'USA',
  '78701',
  'What was the name of your first pet?',
  '$2a$10$KsTINbEvSpBY9Itpe3jGz.aU5QASa41OWlddGYFggxz2.KqQoWS0.',
  FALSE
)
ON CONFLICT (username) DO NOTHING;

