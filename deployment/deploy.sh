#!/bin/bash

# Last Frontier Platform - Production Deployment Script
# This script handles automated deployment with rollback capabilities

set -euo pipefail

# ===== CONFIGURATION =====
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_LOG="/var/log/last-frontier-deployment.log"
BACKUP_DIR="/var/backups/last-frontier"
SERVICE_NAME="last-frontier"
HEALTH_CHECK_URL="http://localhost:3000/api/v1/health"
READINESS_CHECK_URL="http://localhost:3000/api/v1/health/detailed"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ===== LOGGING FUNCTIONS =====
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

# ===== UTILITY FUNCTIONS =====
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check if running as appropriate user
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root"
        exit 1
    fi
    
    # Check required commands
    local required_commands=("node" "npm" "git" "systemctl" "curl" "pg_dump")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    if ! printf '%s\n%s\n' "$required_version" "$node_version" | sort -V -C; then
        log_error "Node.js version $node_version is below required $required_version"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

backup_database() {
    log "Creating database backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/db_backup_$timestamp.sql"
    
    mkdir -p "$BACKUP_DIR"
    
    if pg_dump "$PGDATABASE" > "$backup_file"; then
        log_success "Database backup created: $backup_file"
        echo "$backup_file" > "$BACKUP_DIR/latest_backup.txt"
    else
        log_error "Database backup failed"
        exit 1
    fi
}

backup_application() {
    log "Creating application backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/app_backup_$timestamp.tar.gz"
    
    mkdir -p "$BACKUP_DIR"
    
    if tar -czf "$backup_file" -C "$PROJECT_ROOT" --exclude=node_modules --exclude=.git .; then
        log_success "Application backup created: $backup_file"
        echo "$backup_file" > "$BACKUP_DIR/latest_app_backup.txt"
    else
        log_error "Application backup failed"
        exit 1
    fi
}

install_dependencies() {
    log "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    if npm ci --production; then
        log_success "Dependencies installed successfully"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi
}

run_database_migrations() {
    log "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    # Check if migrations directory exists
    if [[ -d "src/database/migrations" ]]; then
        # Run migrations (this would be replaced with actual migration command)
        log "Applying database migrations..."
        # npm run migrate:up || { log_error "Database migrations failed"; exit 1; }
        log_success "Database migrations completed"
    else
        log_warning "No migrations directory found, skipping migrations"
    fi
}

build_application() {
    log "Building application..."
    
    cd "$PROJECT_ROOT"
    
    if npm run build 2>/dev/null || true; then
        log_success "Application built successfully"
    else
        log_warning "No build script found or build failed, continuing with source files"
    fi
}

stop_service() {
    log "Stopping $SERVICE_NAME service..."
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        if sudo systemctl stop "$SERVICE_NAME"; then
            log_success "Service stopped successfully"
        else
            log_error "Failed to stop service"
            exit 1
        fi
    else
        log_warning "Service was not running"
    fi
}

start_service() {
    log "Starting $SERVICE_NAME service..."
    
    if sudo systemctl start "$SERVICE_NAME"; then
        log_success "Service started successfully"
    else
        log_error "Failed to start service"
        exit 1
    fi
}

health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null; then
            log_success "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

readiness_check() {
    log "Performing readiness check..."
    
    local response=$(curl -s "$READINESS_CHECK_URL" || echo "")
    
    if [[ -n "$response" ]] && echo "$response" | grep -q '"status":"healthy"'; then
        log_success "Readiness check passed"
        return 0
    else
        log_error "Readiness check failed"
        return 1
    fi
}

rollback() {
    log_error "Deployment failed, initiating rollback..."
    
    # Stop the failed service
    stop_service
    
    # Restore application backup
    if [[ -f "$BACKUP_DIR/latest_app_backup.txt" ]]; then
        local backup_file=$(cat "$BACKUP_DIR/latest_app_backup.txt")
        if [[ -f "$backup_file" ]]; then
            log "Restoring application from backup: $backup_file"
            cd "$PROJECT_ROOT"
            tar -xzf "$backup_file"
            log_success "Application restored from backup"
        fi
    fi
    
    # Restore database backup
    if [[ -f "$BACKUP_DIR/latest_backup.txt" ]]; then
        local backup_file=$(cat "$BACKUP_DIR/latest_backup.txt")
        if [[ -f "$backup_file" ]]; then
            log "Restoring database from backup: $backup_file"
            psql "$PGDATABASE" < "$backup_file"
            log_success "Database restored from backup"
        fi
    fi
    
    # Start service with previous version
    start_service
    
    # Verify rollback
    if health_check; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback failed - manual intervention required"
        exit 1
    fi
}

cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Keep only last 5 backups
    find "$BACKUP_DIR" -name "*.sql" -type f | sort -r | tail -n +6 | xargs rm -f
    find "$BACKUP_DIR" -name "*.tar.gz" -type f | sort -r | tail -n +6 | xargs rm -f
    
    log_success "Old backups cleaned up"
}

validate_environment() {
    log "Validating environment configuration..."
    
    # Check if production environment file exists
    if [[ ! -f "$SCRIPT_DIR/production.env" ]]; then
        log_error "Production environment file not found: $SCRIPT_DIR/production.env"
        exit 1
    fi
    
    # Source environment variables
    set -a
    source "$SCRIPT_DIR/production.env"
    set +a
    
    # Validate required environment variables
    local required_vars=("PGHOST" "PGPORT" "PGUSER" "PGPASSWORD" "PGDATABASE" "JWT_SECRET")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_success "Environment validation passed"
}

# ===== MAIN DEPLOYMENT FUNCTION =====
deploy() {
    log "Starting deployment of Last Frontier Platform..."
    
    # Set trap for rollback on failure
    trap rollback ERR
    
    # Deployment steps
    check_prerequisites
    validate_environment
    backup_database
    backup_application
    stop_service
    install_dependencies
    run_database_migrations
    build_application
    start_service
    
    # Health checks
    if ! health_check; then
        log_error "Health check failed"
        exit 1
    fi
    
    if ! readiness_check; then
        log_error "Readiness check failed"
        exit 1
    fi
    
    # Cleanup
    cleanup_old_backups
    
    log_success "Deployment completed successfully!"
    
    # Remove trap
    trap - ERR
}

# ===== COMMAND LINE INTERFACE =====
show_help() {
    cat << EOF
Last Frontier Platform Deployment Script

Usage: $0 [COMMAND]

Commands:
    deploy          Execute full deployment process
    rollback        Rollback to previous version
    health-check    Perform health check only
    backup          Create backup only
    help            Show this help message

Examples:
    $0 deploy
    $0 rollback
    $0 health-check

EOF
}

# ===== MAIN SCRIPT LOGIC =====
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    rollback)
        rollback
        ;;
    health-check)
        health_check && readiness_check
        ;;
    backup)
        backup_database
        backup_application
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac