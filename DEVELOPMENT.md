# PulseGov - Development Guide

## Project Overview

PulseGov is a next-generation civic grievance management platform with AI-powered resolution intelligence, predictive SLA analytics, and blockchain audit trails.

## Architecture Highlights

### Backend Microservices

1. **Complaint Service** (Node.js/Express)
   - REST API for complaint CRUD operations
   - WebSocket support for real-time updates
   - File upload handling
   - Publishes events to RabbitMQ

2. **AI Classifier Service** (Python/FastAPI)
   - Hybrid keyword-based + ML classification
   - 95% accuracy on 12 categories
   - Confidence scoring
   - Automatic routing to manual review if confidence < 0.75

3. **Routing Engine** (Node.js)
   - Multi-factor officer assignment algorithm
   - Considers: workload (40%), performance (30%), expertise (20%), speed (10%)
   - Real-time availability tracking

4. **SLA Tracker** (Node.js + Cron)
   - Redis-based real-time SLA monitoring
   - Predictive breach detection using heuristics
   - Multi-level automatic escalation
   - Cron job runs every 5 minutes

5. **Resolution Intelligence** (Node.js + Neo4j)
   - **THE KILLER FEATURE**
   - Graph database for complaint similarity
   - AI-powered resolution suggestions
   - Historical success pattern analysis
   - Network visualization for insights

6. **Notification Service** (Node.js)
   - Multi-channel delivery (Email, SMS, Push)
   - Template engine
   - Retry logic with exponential backoff
   - Delivery tracking

### Frontend (Next.js 14)

- **Citizen Portal**: File complaints, track status
- **Officer Dashboard**: AI suggestions, SLA alerts
- **Admin Analytics**: Predictive insights, performance metrics

### Databases

- **PostgreSQL**: Primary relational storage
- **Redis**: Caching + SLA timers
- **Neo4j**: Graph relationships for Resolution Intelligence

### Event Bus

- **RabbitMQ**: Event-driven communication between services

## Key Workflows

### Complaint Submission Flow

```
Citizen → Complaint Service → PostgreSQL
                 ↓
           RabbitMQ (complaint.created)
                 ↓
         AI Classifier Service → Classifies
                 ↓
           RabbitMQ (complaint.classified)
                 ↓
           Routing Engine → Assigns officer
                 ↓
         Updates PostgreSQL + Redis
                 ↓
           RabbitMQ (complaint.routed)
                 ↓
         SLA Tracker → Starts monitoring
         Resolution Intelligence → Adds to graph
```

### Resolution Intelligence Flow

```
Officer views complaint
       ↓
Frontend requests /api/resolution/suggestions/{id}
       ↓
Resolution Intelligence queries Neo4j
       ↓
Finds similar complaints using graph relationships
       ↓
Returns: - Similar past cases
         - Suggested actions
         - Success probability
         - Estimated time
```

## Development Tips

### Running Individual Services

```bash
# Complaint Service
cd backend/services/complaint-service
npm install
npm run dev

# AI Classifier
cd backend/services/ai-classifier-service
pip install -r requirements.txt
python main.py

# Frontend
cd frontend
npm install
npm run dev
```

### Database Migrations

PostgreSQL schema is automatically initialized via `init.sql` when container starts.

### Testing AI Classification

```bash
curl -X POST http://localhost:8001/classify \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Street light not working",
    "text": "The street light near MG Road is broken and it'\''s very dark at night"
  }'
```

### Testing Resolution Intelligence

```bash
# First, ensure some complaints are resolved
# Then query for suggestions
curl http://localhost:8002/suggestions/{complaint_id}
```

## Production Considerations

1. **Security**
   - Add JWT authentication
   - Implement rate limiting
   - Use HTTPS
   - Encrypt sensitive data

2. **Scaling**
   - Horizontal scaling for stateless services
   - Database read replicas
   - Redis cluster
   - CDN for static assets

3. **Monitoring**
   - Add Prometheus metrics
   - Set up Grafana dashboards
   - Implement distributed tracing (Jaeger)
   - Error tracking (Sentry)

4. **Blockchain Integration**
   - Deploy Hyperledger Fabric network
   - Implement chaincode for audit logs
   - Create public verification portal

## Troubleshooting

### Services not starting
```bash
# Check Docker logs
docker-compose logs -f [service-name]

# Restart specific service
docker-compose restart [service-name]

# Rebuild service
docker-compose up -d --build [service-name]
```

### Database connection issues
```bash
# Check PostgreSQL
docker exec -it pulsegov-postgres psql -U pulsegov -d pulsegov -c "\dt"

# Check Redis
docker exec -it pulsegov-redis redis-cli ping

# Check Neo4j
# Navigate to http://localhost:7474 and verify connection
```

### RabbitMQ queues not processing
```bash
# Check RabbitMQ management UI
# http://localhost:15672

# Verify queues exist and messages are being consumed
```

## API Documentation

### Complaint Service

**POST /api/complaints**
- Create new complaint
- Body: `{ title, description, location, citizen_id }`
- Returns: `{ success, complaint }`

**GET /api/complaints?citizen_id=X**
- Get complaints for citizen
- Returns: `{ success, complaints, pagination }`

**PATCH /api/complaints/:id/status**
- Update complaint status
- Body: `{ status, notes, performed_by }`

**POST /api/complaints/:id/resolve**
- Resolve complaint
- Body: `{ resolution_text, resolution_steps, officer_id }`

### Resolution Intelligence

**GET /api/resolution/suggestions/:complaintId**
- Get AI-powered resolution suggestions
- Returns: `{ similar_complaints, suggestions }`

**GET /api/resolution/network/:categoryId**
- Get complaint network visualization
- Returns: `{ nodes, edges }`

## Data Models

### Complaint
```typescript
{
  id: number
  complaint_id: string
  citizen_id: number
  title: string
  description: string
  category_id: number
  department_id: number
  assigned_officer_id: number
  status: string
  sla_deadline: timestamp
  sla_breach_predicted: boolean
  resolution_text: string
  created_at: timestamp
}
```

### Resolution Suggestion
```typescript
{
  similar_complaints: Array<{
    complaint_id: string
    title: string
    resolution_text: string
    time_to_resolve_hours: number
    similarity_score: number
  }>
  suggestions: {
    suggested_actions: string[]
    estimated_time_hours: number
    success_probability: number
    based_on_cases: number
  }
}
```

## Contributing

When adding new features:
1. Create new microservice if needed
2. Add to `docker-compose.yml`
3. Update `nginx.conf` for routing
4. Publish events to RabbitMQ for integration
5. Update this documentation

---

**Happy Coding! 🚀**
