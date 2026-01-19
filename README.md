# Coffee POS System (Electron + SQLite)

A lightweight, legency support Point of Sale (POS) system designed for coffee shops. Built with **Electron** and **Better-SQLite3**, it features a dual-screen display (Cashier & Customer) and local database management.

## Key Features

- **Dual-Window Sync**: Real-time cart synchronization between the cashier admin and the customer-facing display.
- **Thermal Printer Integration**: Automated receipt printing using HTML templates.
- **Modular Management**: Easy management of products, categories, and inventory.
- **Data Security**: Local storage using SQLite with optimized indexing for fast order history lookups.
- **Reporting**: Export detailed sales reports to CSV format for business analysis.

## Installation & Setup

### Prerequisites

- Node.js (v16.x)
- Windows Build Tools (for better-sqlite3 compilation)

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/anna4dev/my-pos.git
   cd coffee-pos
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Initialize the database**

   ```bash
   npm run init-data
   ```

4. **Run in development mode**

   ```bash
   npm run dev
   ```

### Available Scripts

- `npm start`: Launches the Electron application.

- `npm run rebuild`: Recompiles better-sqlite3 for your specific Electron version.

- `npm run init-data`: Clears the database and injects initial sample data.

- `npm run pack`: Packages the app into a 32-bit Windows executable (.exe).

## Database Schema

The system uses a relational SQLite database with the following structure:

### `categories` (Product Categories)

| Column | Type    | Description                       |
| :----- | :------ | :-------------------------------- |
| `id`   | INTEGER | Primary Key, Auto-increment       |
| `name` | TEXT    | Category name (e.g., Coffee, Tea) |

### `products` (Menu Items)

| Column        | Type    | Description                                         |
| :------------ | :------ | :-------------------------------------------------- |
| `id`          | INTEGER | Primary Key, Auto-increment                         |
| `category_id` | INTEGER | Foreign Key to `categories.id`                      |
| `name`        | TEXT    | Product name                                        |
| `price`       | INTEGER | Price in **cents** (to avoid floating point issues) |
| `options`     | TEXT    | JSON string of variations (e.g., ["Hot", "Ice"])    |

### `orders` (Order Headers)

| Column         | Type     | Description            |
| :------------- | :------- | :--------------------- |
| `id`           | INTEGER  | Primary Key            |
| `order_no`     | TEXT     | Unique order reference |
| `total_amount` | INTEGER  | Total price in cents   |
| `created_at`   | DATETIME | Timestamp of purchase  |

### `order_items` (Order Details)

| Column         | Type    | Description                       |
| :------------- | :------ | :-------------------------------- |
| `id`           | INTEGER | Primary Key                       |
| `order_id`     | INTEGER | Foreign Key to `orders.id`        |
| `product_name` | TEXT    | Snapshot of name at time of sale  |
| `unit_price`   | INTEGER | Snapshot of price at time of sale |
| `quantity`     | INTEGER | Number of items purchased         |
| `options_used` | TEXT    | JSON string of selected options   |

## License

This project is licensed under the ISC License.
