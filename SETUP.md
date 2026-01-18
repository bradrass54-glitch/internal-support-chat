# Internal Support Chat System - Setup & Documentation

## Overview

The Internal Support Chat System is a conversational AI-driven platform designed to replace traditional ticket systems for internal support requests across IT, HR, and Finance departments. The system provides immediate assistance through intelligent chat, pattern detection for recurring issues, and seamless escalation to live agents when needed.

## Architecture

### Core Components

**Database Layer**
- **Users & Departments**: Multi-department user management with role-based access control
- **Conversations & Messages**: Full conversation history with audit trails
- **Patterns & Alerts**: Recurring issue detection and proactive notifications
- **Escalation Tickets**: Live agent assignment and tracking
- **Audit Logs**: Complete security audit trail for compliance

**Backend Services**
- **Support Service**: Core business logic for conversations, escalations, and pattern detection
- **AI Service**: LLM integration for contextual response generation
- **Admin Service**: Administrative operations and monitoring
- **Background Jobs**: Automated pattern detection and alert management

**Frontend**
- **Chat Interface**: Real-time messaging with department routing
- **Alert Display**: Proactive notifications about known issues
- **Admin Dashboard**: Pattern monitoring and escalation management

## Security Features

### Data Protection
- **Audit Logging**: Every action is logged with user, timestamp, and changes
- **Role-Based Access Control**: Users, agents, and admins have distinct permissions
- **Input Validation**: All user inputs are validated and sanitized
- **Secure API**: TRPC with authentication middleware

### Compliance
- **GDPR Ready**: Data retention policies and user data management
- **Session Management**: Automatic timeout and secure cookie handling
- **IP Logging**: Request origin tracking for security analysis
- **User Agent Tracking**: Browser and client identification

## Database Schema

### Key Tables

**conversations**
- Stores chat sessions with status tracking (open, escalated, closed, pending)
- Links users to departments
- Contains AI-generated summaries

**messages**
- Individual messages within conversations
- Tracks sender type (user, agent, system)
- Stores AI-generated flag and metadata for analysis
- Content hash for pattern detection

**patterns**
- Identified recurring issues
- Occurrence count and confidence score
- Suggested solutions

**alerts**
- Proactive notifications about known issues
- Severity levels: low, medium, high, critical
- Expiration management

**auditLogs**
- Complete action history
- User identification and IP tracking
- Before/after change tracking

**escalationTickets**
- Live agent assignments
- Priority levels and status tracking
- Resolution timestamps

## API Endpoints

### Support Router (`/api/trpc/support.*`)

**Conversations**
- `createConversation`: Start a new support chat
- `getConversation`: Retrieve a specific conversation
- `getUserConversations`: List user's conversations
- `closeConversation`: End a conversation

**Messages**
- `addMessage`: Send a message in a conversation
- `getMessages`: Retrieve conversation history

**Escalations**
- `escalateConversation`: Escalate to a live agent

**Alerts**
- `getAlerts`: Retrieve active alerts for a department

**Learning**
- `recordFeedback`: Submit feedback on AI responses

**Documentation**
- `getDepartments`: List available departments
- `getDepartmentDocumentation`: Get AI training data

### Admin Router (`/api/trpc/admin.*`)

**Management**
- `createDepartment`: Create new department
- `addDocumentation`: Add training data
- `createAlert`: Create proactive alert
- `detectPatterns`: Trigger pattern detection

**Monitoring**
- `getEscalationTickets`: View escalations
- `updateEscalationStatus`: Update ticket status
- `getAuditLogs`: View action history
- `getStatistics`: System statistics

## Setup Instructions

### 1. Environment Configuration

Create `.env.local` with required variables:

```bash
# Database
DATABASE_URL=mysql://user:password@host/database

# OAuth
OAUTH_SERVER_URL=https://your-oauth-provider.com
OWNER_OPEN_ID=your-owner-id

# LLM Integration (Optional)
OPENAI_API_KEY=sk-...
```

### 2. Database Migration

```bash
# Generate and apply migrations
pnpm db:push
```

### 3. Initialize Departments

The system comes with three default departments:
- **IT**: Information Technology support
- **HR**: Human Resources support
- **Finance**: Financial services support

Add custom departments through the admin API.

### 4. Add Documentation

Train the AI system by adding department-specific documentation:

```typescript
await adminRouter.addDocumentation.mutate({
  departmentId: 1,
  title: "Password Reset Procedure",
  content: "Step-by-step guide for resetting passwords...",
  category: "IT",
});
```

### 5. Start Background Jobs

Background jobs automatically run when the server starts:
- Pattern detection every 30 minutes
- Alert cleanup every hour

## Usage Guide

### For End Users

1. **Start a Conversation**
   - Select a department (IT, HR, Finance)
   - Describe your issue in natural language
   - The AI analyzes your request and provides guidance

2. **Receive Proactive Alerts**
   - Known issues appear as alerts at the top of the chat
   - Alerts include severity levels and solutions

3. **Escalate When Needed**
   - Request escalation to a live agent
   - Specify priority level and reason
   - Agent receives full conversation context

4. **Provide Feedback**
   - Rate AI responses as helpful or not helpful
   - System learns from your feedback

### For Administrators

1. **Monitor Patterns**
   - View recurring issues in the admin dashboard
   - Create alerts for known problems
   - Track pattern trends

2. **Manage Escalations**
   - View pending escalations
   - Update ticket status
   - Track resolution times

3. **Review Audit Logs**
   - Monitor all system actions
   - Track user activities
   - Ensure compliance

4. **Add Documentation**
   - Upload department guides
   - Update AI training data
   - Improve response quality

## Pattern Detection

### How It Works

1. **Message Analysis**: Each message is hashed for comparison
2. **Grouping**: Similar messages are grouped together
3. **Threshold**: Patterns emerge when 2+ similar messages are detected
4. **Confidence**: Confidence score increases with more occurrences
5. **Alert Creation**: High-confidence patterns trigger alerts

### Example Pattern

```
Pattern: Password Reset Issues
Occurrences: 15
Confidence: 0.85
Suggested Solution: Direct users to IT portal or provide reset link
```

## Performance Considerations

### Optimization Tips

1. **Message Pagination**: Load messages in batches of 50
2. **Pattern Detection**: Runs every 30 minutes, not real-time
3. **Alert Caching**: Alerts are cached in the frontend
4. **Database Indexes**: Key queries use indexed fields

### Scalability

- Database indexes on userId, departmentId, status, createdAt
- Conversation pagination for large histories
- Pattern detection runs asynchronously
- Background jobs don't block main thread

## Troubleshooting

### Common Issues

**No AI responses**
- Check OpenAI API key configuration
- Verify LLM service availability
- Check fallback responses are working

**Pattern detection not working**
- Verify background jobs are running
- Check database connectivity
- Review error logs

**Escalations not appearing**
- Confirm agent user exists
- Check department assignment
- Verify escalation ticket creation

## Future Enhancements

- Real-time WebSocket support for live agent chat
- Advanced NLP for better intent detection
- Machine learning model for response ranking
- Multi-language support
- Integration with ticketing systems
- Advanced analytics dashboard
- Sentiment analysis for priority routing

## Security Best Practices

1. **Regular Audits**: Review audit logs weekly
2. **Access Control**: Limit admin access to necessary personnel
3. **Data Retention**: Archive old conversations per policy
4. **API Keys**: Rotate LLM API keys regularly
5. **Database**: Use SSL connections and strong passwords
6. **Monitoring**: Set up alerts for suspicious activities

## Support

For issues or questions, contact the development team or refer to the inline code documentation.
