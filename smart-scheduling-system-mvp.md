# Smart Scheduling System MVP

## Core Idea

A simple, tablet-friendly scheduling system designed for small businesses such as:

- cafés
- restaurants
- fishmonger stores
- bakeries
- retail/sales stores
- small service businesses

The platform helps managers create weekly schedules quickly while allowing employees to manage their shifts from their phones.

The system focuses heavily on:

- speed
- simplicity
- intelligent scheduling suggestions
- business-specific learning

The main value proposition:

- save time creating schedules
- reduce scheduling mistakes
- simplify shift management
- improve staffing during busy hours
- provide AI-assisted scheduling suggestions
- learn from business behavior over time

---

# Target Users

## Managers

Need to:

- create schedules quickly
- manage employees
- avoid scheduling conflicts
- reduce overtime
- handle shift swaps
- optimize staffing during busy hours

---

## Employees

Need to:

- see shifts easily
- request shift swaps
- update availability
- access schedules from phones

---

# MVP Features

## 1. Weekly Schedule View

### Requirements

- Horizontal weekly calendar
- Days shown as columns
- Employees shown as rows
- Drag & drop shifts
- Tablet-friendly layout
- Responsive design for desktop + tablet
- Fast interaction and clean UI

### Shift Card

Each shift should display:

- employee name
- role
- start time
- end time
- break time
- notes
- color tag

---

## 2. Employee Management

### Employee Data

Store:

- full name
- email
- phone number
- role
- hourly wage
- availability
- preferred shifts
- notes

### Example Roles

- waiter
- bartender
- kitchen staff
- cashier
- fishmonger
- sales associate
- manager

---

## 3. Shift Management

### Managers Can

- create shifts
- edit shifts
- delete shifts
- assign workers
- duplicate previous weeks
- copy schedules
- manually override AI suggestions

### Shift Data

- employee
- role
- date
- start time
- end time
- break time
- notes

---

## 4. Employee Portal

### Employees Can

- view upcoming shifts
- request shift swaps
- accept/reject swaps
- mark unavailable days
- update availability
- receive future notifications

### UX Goals

- mobile-first design
- simple calendar interface
- fast loading
- easy navigation

---

## 5. AI Scheduling Assistant

Use Ollama locally in the background.

The AI system should assist managers by generating smart scheduling suggestions based on:

- industry patterns
- business type
- historical schedules
- employee availability
- staffing history
- business-specific behavior

The AI should act as an assistant, not a fully autonomous scheduler.

---

# AI Scheduling Suggestions

The system should suggest:

- who should work
- understaffed shifts
- overtime risks
- scheduling conflicts
- best employee matches
- recommended staffing levels
- shift balancing
- optimal coverage during busy periods

---

# Industry-Based Intelligence

The system should understand common patterns across industries.

Examples:

- cafés are often busiest during weekends around lunch hours
- restaurants are busiest Thursday, Friday, and Saturday evenings
- fishmonger stores may peak early mornings and weekends
- retail stores may become busy during afternoons, holidays, or sales periods

The AI should use these patterns as baseline intelligence when generating schedules.

---

# Store-Specific Learning

The most important feature is that the system learns from each specific business over time.

The system should:

- track historical schedules
- observe busy periods
- identify recurring staffing patterns
- learn preferred employee combinations
- recognize peak hours
- adapt recommendations based on real usage

Example:

If a café consistently becomes busy every Saturday around 12:00, the system should remember this and recommend stronger staffing during those hours.

The AI should become smarter for each individual store.

---

# Cache-Based Memory System

The application should use a cache/memory system to store:

- scheduling history
- staffing patterns
- peak business hours
- accepted/rejected AI suggestions
- employee preferences
- historical recommendations
- store-specific behavior

This allows the system to continuously improve scheduling recommendations over time.

---

# Scheduling Rules

The scheduling engine should support rules such as:

- max weekly hours
- minimum rest time
- unavailable dates
- required staff count
- role requirements
- overtime prevention
- employee age/work restrictions if needed

The rules engine should always have higher priority than AI suggestions.

---

# Technical Direction

## Frontend

- React
- Tailwind CSS
- Responsive layout
- Tablet-first design

---

## Backend

Option 1:

- Node.js + Express

Option 2:

- Python + FastAPI

---

## Database

- PostgreSQL

---

## AI Layer

- Ollama locally
- lightweight local model
- cache-based recommendation memory
- rule engine combined with AI suggestions

---

## Deployment

Single responsive web application:

- works on tablets
- works on desktop
- no separate mobile app initially

---

# MVP Goal

The MVP should solve one problem extremely well:

> “Create and manage staff schedules in under 10 minutes.”

---

# Important Product Direction

The system should remain:

- simple
- fast
- lightweight
- easy to learn

Avoid building a massive enterprise platform initially.

The focus should remain on:

- scheduling
- staffing optimization
- employee shift management
- intelligent scheduling assistance

---

# NOT Part of Initial MVP

Do not build initially:

- POS systems
- reservations
- inventory management
- accounting
- payroll systems
- advanced analytics dashboards
- autonomous AI scheduling
- complicated enterprise tools

Focus only on scheduling and staffing first.
