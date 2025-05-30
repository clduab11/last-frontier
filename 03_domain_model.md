# Domain Model - Parallax Analytics "Last Frontier" Platform

## Core Entities

### User Entity
**Description**: Represents platform users across all subscription tiers

**Attributes**:
- `userId`: UUID (Primary Key)
- `email`: String (Unique, Required)
- `passwordHash`: String (Optional - OAuth users)
- `firstName`: String (Required)
- `lastName`: String (Required)
- `profileImage`: String (URL, Optional)
- `emailVerified`: Boolean (Default: false)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp
- `lastLoginAt`: Timestamp (Optional)
- `status`: Enum [ACTIVE, SUSPENDED, DELETED]
- `preferences`: JSON Object

**Validation Rules**:
- Email must be valid format and unique
- Password must meet complexity requirements (if provided)
- Names must be non-empty strings
- Profile image must be valid URL format

**Business Rules**:
- Users can have multiple authentication providers
- Email verification required for password-based accounts
- Soft delete for GDPR compliance

// TEST: User creation with valid data
// TEST: Email uniqueness validation
// TEST: Password complexity validation
// TEST: User status transitions

### Subscription Entity
**Description**: Manages user subscription tiers and billing

**Attributes**:
- `subscriptionId`: UUID (Primary Key)
- `userId`: UUID (Foreign Key to User)
- `tier`: Enum [CREATIVE, RESEARCH, ENTERPRISE]
- `status`: Enum [ACTIVE, CANCELLED, EXPIRED, SUSPENDED]
- `startDate`: Timestamp
- `endDate`: Timestamp (Optional)
- `autoRenew`: Boolean (Default: true)
- `billingCycle`: Enum [MONTHLY, YEARLY]
- `priceAmount`: Decimal
- `currency`: String (ISO 4217)
- `paymentMethodId`: String
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

**Relationships**:
- One-to-One with User (active subscription)
- One-to-Many with PaymentTransaction

**Business Rules**:
- Only one active subscription per user
- Tier changes take effect at next billing cycle
- Grace period for failed payments (7 days)
- Automatic downgrade to free tier after expiration

// TEST: Subscription creation and activation
// TEST: Tier change billing calculations
// TEST: Subscription expiration handling
// TEST: Payment failure grace period

### UsageQuota Entity
**Description**: Tracks and enforces usage limits per subscription tier

**Attributes**:
- `quotaId`: UUID (Primary Key)
- `subscriptionId`: UUID (Foreign Key to Subscription)
- `tier`: Enum [CREATIVE, RESEARCH, ENTERPRISE]
- `textGenerationLimit`: Integer
- `imageGenerationLimit`: Integer
- `batchProcessingLimit`: Integer
- `apiCallsLimit`: Integer
- `storageLimit`: Integer (in MB)
- `resetPeriod`: Enum [DAILY, MONTHLY]
- `resetDate`: Timestamp
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

**Business Rules**:
- Quotas reset based on resetPeriod
- Enterprise tier has unlimited quotas (represented as -1)
- Quota enforcement happens at API gateway level
- Usage tracking must be real-time

// TEST: Quota limit enforcement
// TEST: Quota reset functionality
// TEST: Tier-based quota assignment
// TEST: Real-time usage tracking

### UsageMetrics Entity
**Description**: Records actual usage for billing and analytics

**Attributes**:
- `metricId`: UUID (Primary Key)
- `userId`: UUID (Foreign Key to User)
- `subscriptionId`: UUID (Foreign Key to Subscription)
- `serviceType`: Enum [TEXT_GENERATION, IMAGE_GENERATION, BATCH_PROCESSING]
- `requestCount`: Integer
- `tokensUsed`: Integer
- `processingTime`: Integer (milliseconds)
- `costInVCU`: Decimal
- `timestamp`: Timestamp
- `metadata`: JSON Object

**Relationships**:
- Many-to-One with User
- Many-to-One with Subscription

**Business Rules**:
- Metrics recorded for every API call
- Aggregated for billing and analytics
- Retained for compliance and auditing
- Real-time updates for quota enforcement

// TEST: Usage metric recording accuracy
// TEST: Real-time aggregation performance
// TEST: Billing calculation from metrics
// TEST: Analytics data generation

### ParallaxIntegration Entity
**Description**: Manages Parallax Analytics VCU Inference Service API integration and VCU token handling

**Attributes**:
- `integrationId`: UUID (Primary Key)
- `userId`: UUID (Foreign Key to User)
- `parallaxApiKey`: String (Encrypted)
- `vcuBalance`: Decimal
- `vvvTokens`: Decimal
- `lastSyncAt`: Timestamp
- `status`: Enum [ACTIVE, INACTIVE, ERROR]
- `errorMessage`: String (Optional)
- `rateLimitRemaining`: Integer
- `rateLimitResetAt`: Timestamp
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

**Business Rules**:
- VCU tokens automatically purchased when balance low
- Rate limits respected and tracked
- Integration status monitored continuously
- Encrypted storage of API credentials

// TEST: VCU token automatic purchasing
// TEST: Rate limit tracking and enforcement
// TEST: Integration status monitoring
// TEST: API credential encryption/decryption

### ContentGeneration Entity
**Description**: Records all content generation requests and results

**Attributes**:
- `generationId`: UUID (Primary Key)
- `userId`: UUID (Foreign Key to User)
- `requestType`: Enum [TEXT, IMAGE, BATCH]
- `prompt`: Text
- `parameters`: JSON Object
- `result`: Text/URL
- `status`: Enum [PENDING, PROCESSING, COMPLETED, FAILED]
- `processingTime`: Integer (milliseconds)
- `vcuCost`: Decimal
- `moderationStatus`: Enum [APPROVED, FLAGGED, REJECTED]
- `moderationReason`: String (Optional)
- `createdAt`: Timestamp
- `completedAt`: Timestamp (Optional)

**Relationships**:
- Many-to-One with User
- One-to-Many with ModerationLog

**Business Rules**:
- All content subject to moderation based on tier
- Generation history retained per tier policy
- Failed generations don't consume quota
- Batch processing queued for Research/Enterprise tiers

// TEST: Content generation workflow
// TEST: Moderation integration
// TEST: Generation history management
// TEST: Batch processing queue

### PaymentTransaction Entity
**Description**: Records all payment transactions and billing events

**Attributes**:
- `transactionId`: UUID (Primary Key)
- `subscriptionId`: UUID (Foreign Key to Subscription)
- `amount`: Decimal
- `currency`: String (ISO 4217)
- `paymentMethod`: Enum [STRIPE, COINBASE, METAMASK]
- `paymentProvider`: String
- `providerTransactionId`: String
- `status`: Enum [PENDING, COMPLETED, FAILED, REFUNDED]
- `description`: String
- `metadata`: JSON Object
- `createdAt`: Timestamp
- `processedAt`: Timestamp (Optional)

**Business Rules**:
- All payments recorded regardless of status
- Refunds create new transaction records
- Cryptocurrency payments include blockchain details
- Failed payments trigger retry logic

// TEST: Payment transaction recording
// TEST: Refund transaction handling
// TEST: Cryptocurrency payment validation
// TEST: Payment retry logic

### ModerationLog Entity
**Description**: Audit trail for content moderation decisions

**Attributes**:
- `logId`: UUID (Primary Key)
- `generationId`: UUID (Foreign Key to ContentGeneration)
- `moderationType`: Enum [AUTOMATED, MANUAL, APPEAL]
- `decision`: Enum [APPROVED, FLAGGED, REJECTED]
- `reason`: String
- `moderatorId`: UUID (Optional - for manual moderation)
- `confidence`: Decimal (0.0-1.0)
- `appealStatus`: Enum [NONE, PENDING, APPROVED, REJECTED]
- `createdAt`: Timestamp

**Business Rules**:
- All moderation decisions logged
- Appeals tracked with separate entries
- Automated moderation includes confidence scores
- Manual moderation requires moderator ID

// TEST: Moderation decision logging
// TEST: Appeal process tracking
// TEST: Confidence score validation
// TEST: Moderator assignment

### ApiKey Entity
**Description**: Manages user API keys for programmatic access

**Attributes**:
- `keyId`: UUID (Primary Key)
- `userId`: UUID (Foreign Key to User)
- `keyHash`: String (Hashed API key)
- `keyPrefix`: String (First 8 characters for display)
- `name`: String (User-defined name)
- `permissions`: JSON Array (Scoped permissions)
- `lastUsedAt`: Timestamp (Optional)
- `expiresAt`: Timestamp (Optional)
- `status`: Enum [ACTIVE, REVOKED, EXPIRED]
- `createdAt`: Timestamp
- `revokedAt`: Timestamp (Optional)

**Business Rules**:
- API keys inherit user subscription permissions
- Keys can have scoped permissions subset
- Automatic expiration for security
- Usage tracking for analytics

// TEST: API key generation and validation
// TEST: Permission scope enforcement
// TEST: Key expiration handling
// TEST: Usage tracking accuracy

## Entity Relationships

### User Relationships
- User 1:1 Subscription (active)
- User 1:* UsageMetrics
- User 1:1 ParallaxIntegration
- User 1:* ContentGeneration
- User 1:* ApiKey

### Subscription Relationships
- Subscription 1:1 UsageQuota
- Subscription 1:* PaymentTransaction
- Subscription 1:* UsageMetrics

### ContentGeneration Relationships
- ContentGeneration 1:* ModerationLog

## Data Validation Rules

### Email Validation
```
FUNCTION validateEmail(email: String) -> Boolean
  RETURN email MATCHES regex "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
END FUNCTION
```

### Password Validation
```
FUNCTION validatePassword(password: String) -> Boolean
  IF password.length < 8 THEN RETURN false
  IF NOT password CONTAINS uppercase THEN RETURN false
  IF NOT password CONTAINS lowercase THEN RETURN false
  IF NOT password CONTAINS digit THEN RETURN false
  IF NOT password CONTAINS special_character THEN RETURN false
  RETURN true
END FUNCTION
```

### Tier-Based Quota Validation
```
FUNCTION validateQuotaUsage(userId: UUID, serviceType: ServiceType, requestCount: Integer) -> Boolean
  quota = getActiveQuota(userId)
  currentUsage = getCurrentUsage(userId, serviceType, quota.resetPeriod)
  
  SWITCH serviceType
    CASE TEXT_GENERATION:
      RETURN (currentUsage + requestCount) <= quota.textGenerationLimit
    CASE IMAGE_GENERATION:
      RETURN (currentUsage + requestCount) <= quota.imageGenerationLimit
    CASE BATCH_PROCESSING:
      RETURN (currentUsage + requestCount) <= quota.batchProcessingLimit
  END SWITCH
END FUNCTION
```

## State Transitions

### User Status Transitions
```
ACTIVE -> SUSPENDED (admin action, policy violation)
ACTIVE -> DELETED (user request, GDPR)
SUSPENDED -> ACTIVE (admin action, appeal approved)
SUSPENDED -> DELETED (user request, permanent ban)
DELETED -> (no transitions - terminal state)
```

### Subscription Status Transitions
```
ACTIVE -> CANCELLED (user cancellation)
ACTIVE -> EXPIRED (billing failure, end of term)
ACTIVE -> SUSPENDED (payment failure, policy violation)
CANCELLED -> ACTIVE (reactivation before expiration)
EXPIRED -> ACTIVE (renewal, reactivation)
SUSPENDED -> ACTIVE (payment resolution, appeal)
SUSPENDED -> EXPIRED (grace period expiration)
```

### Content Generation Status Transitions
```
PENDING -> PROCESSING (queue processing starts)
PROCESSING -> COMPLETED (successful generation)
PROCESSING -> FAILED (generation error, timeout)
COMPLETED -> (terminal state)
FAILED -> (terminal state)
```

## Business Invariants

### Subscription Invariants
- User can have only one active subscription at a time
- Subscription tier determines quota limits and features
- Payment failure triggers grace period before suspension
- Tier changes take effect at next billing cycle

### Usage Quota Invariants
- Quota limits enforced in real-time at API gateway
- Enterprise tier has unlimited quotas (represented as -1)
- Quotas reset based on subscription billing cycle
- Usage tracking must be accurate and tamper-proof

### Content Moderation Invariants
- All generated content subject to tier-appropriate moderation
- Moderation decisions logged with audit trail
- Appeals process available for flagged content
- Enterprise tier can have custom moderation rules

### Payment Invariants
- All transactions recorded regardless of outcome
- Refunds create new transaction records
- Cryptocurrency payments include blockchain verification
- Failed payments trigger automated retry with exponential backoff

## Data Retention Policies

### User Data Retention
- Active users: Indefinite retention
- Deleted users: 30-day soft delete, then permanent deletion
- GDPR requests: Immediate anonymization/deletion
- Audit logs: 7-year retention for compliance

### Usage Metrics Retention
- Real-time metrics: 90 days
- Aggregated analytics: 2 years
- Billing records: 7 years
- Performance metrics: 1 year

### Content Generation Retention
- Creative tier: 30 days
- Research tier: 90 days
- Enterprise tier: Configurable (default 1 year)
- Moderation logs: 2 years

// TEST: Data retention policy enforcement
// TEST: GDPR deletion compliance
// TEST: Audit log retention accuracy
// TEST: Tier-based content retention