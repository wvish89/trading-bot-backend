\# Trading Bot Backend API



AI-powered cryptocurrency trading bot with ML predictions and automated trading.



\## Features

\- Real-time trading with Binance API

\- ML-based price predictions

\- Risk management (stop-loss, take-profit, trailing stops)

\- Multi-asset portfolio management

\- Trade history and analytics

\- PostgreSQL database integration

\- REST API for frontend



\## Prerequisites

\- Node.js 18+ 

\- PostgreSQL database (Neon.tech recommended)

\- Binance account with API keys



\## Installation



1\. Clone the repository:

```bash

git clone <your-repo-url>

cd trading-bot-backend

```



2\. Install dependencies:

```bash

npm install

```



3\. Create `.env` file:

```bash

cp .env.example .env

\# Edit .env with your credentials

```



4\. Set up database (run this SQL in Neon.tech):

```sql

-- See schema.sql file

CREATE TABLE trades (...);

CREATE TABLE positions (...);

```



5\. Start server:

```bash

npm start

```



\## API Endpoints



\### Health Check

```

GET /health

```



\### Trades

```

GET  /api/trades              - Get all trades

GET  /api/trades/:id          - Get trade by ID

POST /api/trades              - Create new trade

GET  /api/trades/stats/summary - Get statistics

GET  /api/trades/price/:symbol - Get real-time price

```



\### Positions

```

GET    /api/positions         - Get all positions

GET    /api/positions/:symbol - Get position by symbol

POST   /api/positions         - Create position

PUT    /api/positions/:symbol - Update position

DELETE /api/positions/:symbol - Close position

```



\## Deployment



\### Render.com

1\. Push code to GitHub

2\. Create new Web Service on Render

3\. Connect GitHub repository

4\. Add environment variables

5\. Deploy



\### Environment Variables on Render

```

DATABASE\_URL=<your-neon-database-url>

BINANCE\_API\_KEY=<your-key>

BINANCE\_SECRET=<your-secret>

NODE\_ENV=production

PORT=10000

```



\## Database Schema



\### Trades Table

```sql

CREATE TABLE trades (

&nbsp;   id SERIAL PRIMARY KEY,

&nbsp;   symbol VARCHAR(20) NOT NULL,

&nbsp;   trade\_type VARCHAR(4) NOT NULL,

&nbsp;   price DECIMAL(18, 8) NOT NULL,

&nbsp;   quantity DECIMAL(18, 8) NOT NULL,

&nbsp;   total\_value DECIMAL(18, 8) NOT NULL,

&nbsp;   profit\_loss DECIMAL(18, 8),

&nbsp;   confidence INTEGER,

&nbsp;   strategy VARCHAR(50),

&nbsp;   exit\_reason VARCHAR(50),

&nbsp;   created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP

);



CREATE INDEX idx\_symbol ON trades(symbol);

CREATE INDEX idx\_created\_at ON trades(created\_at);

```



\### Positions Table

```sql

CREATE TABLE positions (

&nbsp;   id SERIAL PRIMARY KEY,

&nbsp;   symbol VARCHAR(20) NOT NULL UNIQUE,

&nbsp;   entry\_price DECIMAL(18, 8) NOT NULL,

&nbsp;   current\_price DECIMAL(18, 8),

&nbsp;   quantity DECIMAL(18, 8) NOT NULL,

&nbsp;   stop\_loss DECIMAL(18, 8),

&nbsp;   take\_profit DECIMAL(18, 8),

&nbsp;   trailing\_stop DECIMAL(18, 8),

&nbsp;   unrealized\_pnl DECIMAL(18, 8),

&nbsp;   opened\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,

&nbsp;   updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP

);

```



\## Security

\- Never commit `.env` file

\- Use API keys with trading-only permissions

\- Enable IP whitelist on exchange

\- Use strong passwords for database

\- Regular security audits



\## License

MIT



\## Support

For issues, please open a GitHub issue.

