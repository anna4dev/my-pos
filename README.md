# Coffee POS System (Electron + SQLite)

![Main UI Screenshot](https://res.cloudinary.com/dzzr66tx3/image/upload/v1764916851/admin-main_bjjxgc.png)

A lightweight, legency support Point of Sale (POS) system designed for coffee shops. Built with **Electron** and **Better-SQLite3**, it features a dual-screen display (Cashier & Customer) and local database management.

## Key Features

- **Dual-Window Sync**: Real-time cart synchronization between the cashier admin and the customer-facing display.
- **Thermal Printer Integration**: Automated receipt printing using HTML templates.
- **Modular Management**: Easy management of products, categories, and inventory.
- **Data Security**: Local storage using SQLite with order history lookups.
- **Reporting**: Export detailed sales reports to CSV format for business analysis.

## Installation & Setup

### Prerequisites

- Node.js (v16.x)

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/anna4dev/my-pos.git
   cd my-pos
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

### `users` (Users Infos)

| Column          | Type    | Description     |
| :-------------- | :------ | :-------------- |
| `id`            | INTEGER | Primary Key     |
| `username`      | TEXT    | nickname        |
| `password_hash` | TEXT    | encode password |

## Development Roadmap (TODO)

Future updates will follow this priority order:

1.  **Refactoring & Modularization**

    - [ ] Decouple the monolithic `admin.js` into functional ES modules (Orders, Management, Exports).
    - [ ] Standardize UI components for reusability (Modal).

2.  **Payment Integration**

    - [ ] Support for hardware barcode scanners (Payment code scanning).
    - [ ] Integration with payment gateway APIs and automated post-payment receipt printing.

3.  **Multi-user Support**
    - [ ] Refactor `orders` table to include `admin_id`.
    - [ ] Implement a full User/Staff management system with role-based access control.

## License

This project is licensed under the ISC License.
