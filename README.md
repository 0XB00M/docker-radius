# PostgreSQL with RADIUS Docker Setup

## Directory Structure
Create the following directory structure:

```
postgres-radius-docker/
├── docker-compose.yml
├── init-scripts/
│   └── 01-radius-schema.sql
├── freeradius/
│   ├── clients.conf
│   └── sql.conf
└── README.md
```

## Setup Instructions

### 1. Create Directory Structure
```bash
mkdir -p postgres-radius-docker/{init-scripts,freeradius}
cd postgres-radius-docker
```

### 2. Create docker-compose.yml
Copy the Docker Compose configuration from the template above.

### 3. Create Database Schema
Create `init-scripts/01-radius-schema.sql` with the SQL schema provided in the template.

### 4. Create FreeRADIUS Configuration Files

**Create `freeradius/clients.conf`:**
```conf
client localhost {
    ipaddr = 127.0.0.1
    secret = testing123
    require_message_authenticator = no
    nas_type = other
}

client dockernet {
    ipaddr = 172.0.0.0/8
    secret = testing123
    require_message_authenticator = no
    nas_type = other
}
```

**Create `freeradius/sql.conf`:**
Use the SQL configuration provided in the template above.

### 5. Start the Services
```bash
docker-compose up -d
```

### 6. Verify Setup
Check if services are running:
```bash
docker-compose ps
```

View logs:
```bash
docker-compose logs postgres
docker-compose logs freeradius
```

## Testing RADIUS Authentication

### Test with radtest (from radtest container)
```bash
# Access the test container
docker exec -it radius-test-client bash

# Test authentication
radtest testuser testpass localhost 1812 testing123

# Expected successful response:
# Sent Access-Request Id 123 from 0.0.0.0:12345 to 127.0.0.1:1812 length 73
# Received Access-Accept Id 123 from 127.0.0.1:1812 to 0.0.0.0:12345 length 32
```

### Test from host machine (if radtest is installed)
```bash
radtest testuser testpass localhost 1812 testing123
```

## Database Management

### Connect to PostgreSQL
```bash
docker exec -it postgres-radius psql -U radius -d radius
```

### Common SQL Queries

**Add a new user:**
```sql
INSERT INTO radcheck (username, attribute, op, value) 
VALUES ('newuser', 'Cleartext-Password', ':=', 'newpassword');
```

**View all users:**
```sql
SELECT * FROM radcheck;
```

**Check authentication attempts:**
```sql
SELECT * FROM radacct ORDER BY acctstarttime DESC LIMIT 10;
```

**Add user to a group:**
```sql
INSERT INTO radusergroup (username, groupname, priority) 
VALUES ('testuser', 'admin', 1);
```

## Configuration Customization

### Environment Variables
You can customize the following in `docker-compose.yml`:

- `POSTGRES_DB`: Database name (default: radius)
- `POSTGRES_USER`: Database user (default: radius)  
- `POSTGRES_PASSWORD`: Database password (default: radiuspassword)

### RADIUS Clients
Edit `freeradius/clients.conf` to add your network devices:

```conf
client your-nas {
    ipaddr = 192.168.1.100
    secret = your-shared-secret
    require_message_authenticator = no
    nas_type = cisco
}
```

### Ports
Default ports exposed:
- PostgreSQL: 5432
- RADIUS Auth: 1812/udp
- RADIUS Acct: 1813/udp

## Troubleshooting

### Common Issues

1. **Connection refused to PostgreSQL:**
   - Wait for PostgreSQL to fully initialize
   - Check if port 5432 is available

2. **RADIUS authentication fails:**
   - Verify client configuration in `clients.conf`
   - Check shared secret matches
   - Ensure user exists in `radcheck` table

3. **Database connection errors:**
   - Verify database credentials in `sql.conf`
   - Check if PostgreSQL service is running

### Useful Commands

**View PostgreSQL logs:**
```bash
docker logs postgres-radius
```

**View FreeRADIUS logs:**
```bash
docker logs freeradius-server
```

**Restart services:**
```bash
docker-compose restart
```

**Stop and remove everything:**
```bash
docker-compose down -v
```

## Security Notes

- Change default passwords in production
- Use strong shared secrets for RADIUS clients
- Configure proper firewall rules
- Consider using TLS/SSL for database connections
- Regularly backup the PostgreSQL database

## Backup and Restore

### Backup Database
```bash
docker exec postgres-radius pg_dump -U radius radius > radius_backup.sql
```

### Restore Database
```bash
docker exec -i postgres-radius psql -U radius radius < radius_backup.sql
```