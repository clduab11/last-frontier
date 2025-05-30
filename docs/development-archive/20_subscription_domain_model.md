# 20. Subscription Management Domain Model

## Overview
Domain model defining core entities, relationships, and data structures for the subscription management system with data monetization and ad-supported features.

## Core Entities

### Subscription
**Description**: Central entity representing a user's subscription to the platform.

**Attributes**:
- `id`: UUID - Unique subscription identifier
- `userId`: UUID - Reference to user account
- `tierId`: UUID - Reference to subscription tier
- `status`: SubscriptionStatus - Current subscription state
- `stripeSubscriptionId`: String - Stripe subscription reference
- `currentPeriodStart`: DateTime - Current billing period start
- `currentPeriodEnd`: DateTime - Current billing period end
- `dataCollectionConsent`: DataConsentLevel - User's data sharing preferences
- `adDisplayEnabled`: Boolean - Whether ads are shown to user
- `quotaBonus`: Number - Additional quota from data sharing
- `createdAt`: DateTime - Subscription creation timestamp
- `updatedAt`: DateTime - Last modification timestamp

**Business Rules**:
- Free tier users must have `adDisplayEnabled = true`
- Paid tier users can opt out of data collection
- Quota bonus only applies when data collection is enabled
- Status transitions must follow defined state machine

### SubscriptionTier
**Description**: Defines available subscription tiers with features and pricing.

**Attributes**:
- `id`: UUID - Unique tier identifier
- `name`: String - Tier display name (Free, Pro, Enterprise, Custom)
- `type`: TierType - Tier category (FREE_AD_SUPPORTED, PAID, ENTERPRISE, CUSTOM)
- `monthlyApiCalls`: Number - API call quota per month
- `features`: FeatureSet - Available features for this tier
- `basePrice`: Money - Base monthly price before discounts
- `dataDiscountEligible`: Boolean - Whether data discounts apply
- `adSupported`: Boolean - Whether tier includes advertisements
- `stripePriceId`: String - Stripe price configuration reference
- `isActive`: Boolean - Whether tier is available for new subscriptions
- `createdAt`: DateTime - Tier creation timestamp

**Business Rules**:
- Free tier must have `adSupported = true`
- Only paid tiers can have `dataDiscountEligible = true`
- Custom tiers require manual approval
- Inactive tiers cannot be assigned to new subscriptions

### DataCollectionPolicy
**Description**: Defines data collection rules and discount structures.

**Attributes**:
- `id`: UUID - Unique policy identifier
- `sensitivityLevel`: DataSensitivityLevel - Level of data sensitivity
- `description`: String - Human-readable policy description
- `discountPercentage`: Number - Discount for data sharing (0-20%)
- `dataTypes`: Array<DataType> - Types of data collected
- `retentionPeriod`: Duration - How long data is retained
- `canOptOut`: Boolean - Whether users can opt out
- `telemetryIncluded`: Boolean - Whether telemetry is always collected
- `isActive`: Boolean - Whether policy is currently in use

**Business Rules**:
- Discount percentage must be between 0% and 20%
- Higher sensitivity levels offer higher discounts
- Telemetry is always collected regardless of opt-out status
- Only active policies can be assigned to subscriptions

### UsageRecord
**Description**: Tracks resource consumption for quota enforcement.

**Attributes**:
- `id`: UUID - Unique usage record identifier
- `subscriptionId`: UUID - Reference to subscription
- `resourceType`: ResourceType - Type of resource consumed
- `quantity`: Number - Amount of resource used
- `timestamp`: DateTime - When usage occurred
- `billingPeriodStart`: DateTime - Start of billing period
- `billingPeriodEnd`: DateTime - End of billing period
- `metadata`: JSON - Additional usage context
- `quotaBonusApplied`: Boolean - Whether quota bonus was used

**Business Rules**:
- Usage records are immutable once created
- Timestamps must be within valid billing periods
- Quota bonus only applies to eligible resource types
- Metadata must not contain sensitive information

### Advertisement
**Description**: Manages ad content and delivery for free tier users.

**Attributes**:
- `id`: UUID - Unique advertisement identifier
- `networkId`: String - Ad network reference
- `content`: AdContent - Advertisement content and metadata
- `targetingCriteria`: JSON - Audience targeting rules
- `impressionCount`: Number - Total impressions served
- `clickCount`: Number - Total clicks received
- `revenue`: Money - Revenue generated from ad
- `isActive`: Boolean - Whether ad is currently serving
- `startDate`: DateTime - Ad campaign start date
- `endDate`: DateTime - Ad campaign end date

**Business Rules**:
- Only active ads can be served to users
- Impression and click counts must be accurate
- Revenue tracking required for monetization reporting
- Targeting criteria must comply with privacy regulations

### Invoice
**Description**: Billing documents with itemized charges and discounts.

**Attributes**:
- `id`: UUID - Unique invoice identifier
- `subscriptionId`: UUID - Reference to subscription
- `stripeInvoiceId`: String - Stripe invoice reference
- `billingPeriodStart`: DateTime - Period start date
- `billingPeriodEnd`: DateTime - Period end date
- `baseAmount`: Money - Amount before discounts
- `dataDiscount`: Money - Discount for data sharing
- `totalAmount`: Money - Final amount after discounts
- `taxAmount`: Money - Tax charges
- `status`: InvoiceStatus - Payment status
- `dueDate`: DateTime - Payment due date
- `paidAt`: DateTime - Payment completion timestamp

**Business Rules**:
- Data discounts only apply to eligible subscriptions
- Tax calculations must comply with jurisdiction rules
- Invoice amounts must be accurate and auditable
- Payment status must reflect actual payment state

## Value Objects

### Money
**Description**: Represents monetary amounts with currency.

**Attributes**:
- `amount`: Decimal - Monetary amount
- `currency`: CurrencyCode - ISO currency code

**Business Rules**:
- Amount must be non-negative for charges
- Currency must be supported by payment processor
- Precision limited to 2 decimal places

### FeatureSet
**Description**: Collection of features available to a subscription tier.

**Attributes**:
- `apiAccess`: Boolean - Basic API access
- `advancedAnalytics`: Boolean - Advanced analytics features
- `customIntegrations`: Boolean - Custom integration support
- `prioritySupport`: Boolean - Priority customer support
- `dataExport`: Boolean - Data export capabilities
- `whiteLabeling`: Boolean - White-label options

**Business Rules**:
- Feature availability must align with tier pricing
- Feature changes require subscription tier migration
- Some features may have usage limits

### AdContent
**Description**: Advertisement content and display metadata.

**Attributes**:
- `title`: String - Advertisement title
- `description`: String - Advertisement description
- `imageUrl`: String - Advertisement image URL
- `clickUrl`: String - Destination URL for clicks
- `format`: AdFormat - Display format (banner, interstitial, native)
- `dimensions`: AdDimensions - Display dimensions

**Business Rules**:
- Content must comply with advertising standards
- URLs must be valid and secure (HTTPS)
- Image dimensions must match format requirements
- Content must be appropriate for business audience

## Enumerations

### SubscriptionStatus
- `ACTIVE` - Subscription is active and in good standing
- `PAST_DUE` - Payment failed, grace period active
- `CANCELED` - Subscription canceled, access until period end
- `UNPAID` - Payment failed, access suspended
- `INCOMPLETE` - Subscription setup not completed
- `TRIALING` - In trial period

### TierType
- `FREE_AD_SUPPORTED` - Free tier with advertisements
- `PAID` - Standard paid subscription
- `ENTERPRISE` - Enterprise-level subscription
- `CUSTOM` - Custom configured subscription

### DataSensitivityLevel
- `BASIC_USAGE` - Basic usage patterns (5% discount)
- `CONTENT_PATTERNS` - Content generation patterns (10% discount)
- `BUSINESS_INTELLIGENCE` - Business intelligence data (15% discount)
- `PREDICTIVE_ANALYTICS` - Predictive analytics data (20% discount)

### DataConsentLevel
- `FULL_CONSENT` - User consents to all data collection
- `PARTIAL_CONSENT` - User consents to some data collection
- `MINIMAL_CONSENT` - User consents only to required telemetry
- `OPT_OUT` - User opts out of optional data collection

### ResourceType
- `API_CALLS` - API endpoint invocations
- `STORAGE_BYTES` - Data storage consumption
- `COMPUTE_MINUTES` - Processing time usage
- `BANDWIDTH_BYTES` - Data transfer usage

### InvoiceStatus
- `DRAFT` - Invoice created but not finalized
- `OPEN` - Invoice sent, payment pending
- `PAID` - Invoice paid successfully
- `VOID` - Invoice canceled
- `UNCOLLECTIBLE` - Payment collection failed

### AdFormat
- `BANNER` - Standard banner advertisement
- `INTERSTITIAL` - Full-screen advertisement
- `NATIVE` - Native content advertisement
- `VIDEO` - Video advertisement

## Relationships

### Subscription Relationships
- **Subscription** → **User** (Many-to-One): Each subscription belongs to one user
- **Subscription** → **SubscriptionTier** (Many-to-One): Each subscription has one tier
- **Subscription** → **DataCollectionPolicy** (Many-to-One): Each subscription follows one policy
- **Subscription** → **UsageRecord** (One-to-Many): Each subscription has multiple usage records
- **Subscription** → **Invoice** (One-to-Many): Each subscription generates multiple invoices

### Tier and Policy Relationships
- **SubscriptionTier** → **DataCollectionPolicy** (Many-to-Many): Tiers can have multiple policies
- **DataCollectionPolicy** → **Subscription** (One-to-Many): Policies apply to multiple subscriptions

### Usage and Billing Relationships
- **UsageRecord** → **Subscription** (Many-to-One): Usage records belong to subscriptions
- **Invoice** → **Subscription** (Many-to-One): Invoices belong to subscriptions
- **Advertisement** → **UsageRecord** (One-to-Many): Ads generate usage records

## Aggregates

### Subscription Aggregate
**Root**: Subscription
**Entities**: Subscription, UsageRecord, Invoice
**Value Objects**: Money, FeatureSet

**Responsibilities**:
- Manage subscription lifecycle
- Enforce quota limits
- Calculate billing amounts
- Track usage patterns

**Invariants**:
- Subscription must have valid tier assignment
- Usage cannot exceed quota limits (with grace period)
- Billing amounts must be accurate
- State transitions must be valid

### Billing Aggregate
**Root**: Invoice
**Entities**: Invoice
**Value Objects**: Money

**Responsibilities**:
- Generate accurate invoices
- Apply discounts and taxes
- Track payment status
- Handle payment failures

**Invariants**:
- Invoice amounts must be mathematically correct
- Discounts cannot exceed maximum allowed
- Tax calculations must be compliant
- Payment status must be consistent

### Advertisement Aggregate
**Root**: Advertisement
**Entities**: Advertisement
**Value Objects**: AdContent, Money

**Responsibilities**:
- Manage ad content and delivery
- Track impressions and clicks
- Calculate ad revenue
- Ensure compliance with policies

**Invariants**:
- Ad content must be appropriate and compliant
- Impression/click counts must be accurate
- Revenue calculations must be correct
- Targeting must respect privacy settings

## Domain Events

### Subscription Events
- `SubscriptionCreated` - New subscription established
- `SubscriptionUpgraded` - Tier upgraded
- `SubscriptionDowngraded` - Tier downgraded
- `SubscriptionCanceled` - Subscription canceled
- `SubscriptionReactivated` - Canceled subscription reactivated
- `DataConsentChanged` - User changed data sharing preferences

### Usage Events
- `QuotaExceeded` - Usage exceeded tier limits
- `UsageRecorded` - New usage recorded
- `QuotaReset` - Monthly quota reset occurred
- `QuotaBonusApplied` - Data sharing bonus applied

### Billing Events
- `InvoiceGenerated` - New invoice created
- `PaymentSucceeded` - Payment processed successfully
- `PaymentFailed` - Payment processing failed
- `DiscountApplied` - Data sharing discount applied

### Advertisement Events
- `AdDisplayed` - Advertisement shown to user
- `AdClicked` - User clicked on advertisement
- `AdRevenueGenerated` - Revenue recorded from ad

## Domain Services

### QuotaEnforcementService
**Responsibilities**:
- Check quota limits before API calls
- Apply quota bonuses for data sharing
- Handle quota exceeded scenarios
- Reset quotas on billing cycle

### BillingCalculationService
**Responsibilities**:
- Calculate subscription charges
- Apply data sharing discounts
- Compute taxes and fees
- Generate invoice line items

### DataConsentService
**Responsibilities**:
- Manage user consent preferences
- Validate consent changes
- Apply consent to data collection
- Handle opt-out requests

### AdTargetingService
**Responsibilities**:
- Select appropriate ads for users
- Respect user preferences and privacy
- Track ad performance metrics
- Optimize ad delivery

## Repository Interfaces

### SubscriptionRepository
- `findById(id: UUID): Subscription`
- `findByUserId(userId: UUID): Subscription[]`
- `findByStatus(status: SubscriptionStatus): Subscription[]`
- `save(subscription: Subscription): void`
- `delete(id: UUID): void`

### UsageRecordRepository
- `findBySubscriptionId(subscriptionId: UUID): UsageRecord[]`
- `findByBillingPeriod(start: DateTime, end: DateTime): UsageRecord[]`
- `save(usageRecord: UsageRecord): void`
- `getTotalUsage(subscriptionId: UUID, resourceType: ResourceType): Number`

### InvoiceRepository
- `findById(id: UUID): Invoice`
- `findBySubscriptionId(subscriptionId: UUID): Invoice[]`
- `findByStatus(status: InvoiceStatus): Invoice[]`
- `save(invoice: Invoice): void`

### AdvertisementRepository
- `findActiveAds(): Advertisement[]`
- `findByTargetingCriteria(criteria: JSON): Advertisement[]`
- `save(advertisement: Advertisement): void`
- `updateMetrics(id: UUID, impressions: Number, clicks: Number): void`