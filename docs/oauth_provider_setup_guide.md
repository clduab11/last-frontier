# OAuth Provider Setup Guide

Complete setup instructions for configuring OAuth authentication with Google, GitHub, and LinkedIn providers using Supabase.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Callback URI Information](#callback-uri-information)
4. [Google OAuth Setup](#google-oauth-setup)
5. [GitHub OAuth Setup](#github-oauth-setup)
6. [LinkedIn OAuth Setup](#linkedin-oauth-setup)
7. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
8. [Testing Your OAuth Configuration](#testing-your-oauth-configuration)

---

## Overview

This guide walks you through setting up OAuth authentication with three major providers:

- **Google** - For Gmail and Google Workspace users
- **GitHub** - For developers and GitHub users  
- **LinkedIn** - For professional networking users

Each provider requires creating an OAuth application in their developer console and configuring specific settings.

## Prerequisites

Before starting, ensure you have:

- ✅ Access to each provider's developer console
- ✅ A Supabase project set up
- ✅ Administrative access to your application domain
- ✅ Basic understanding of OAuth 2.0 flow

## Callback URI Information

**Important**: All providers must use this exact callback URI:

```
https://hrkznrcmotfdvyapbhim.supabase.co/auth/v1/callback
```

> **⚠️ Warning**: The callback URI must match exactly (including protocol, domain, and path). Any deviation will cause authentication failures.

---

## Google OAuth Setup

### Step 1: Access Google Cloud Console

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Select an existing project or create a new one

*📸 Screenshot indicator: Google Cloud Console dashboard with project selector*

### Step 2: Enable Google+ API

1. In the left sidebar, navigate to **APIs & Services** > **Library**
2. Search for "Google+ API" 
3. Click on the result and press **Enable**
4. Also enable "Google Identity" if available

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (unless you're using Google Workspace)
3. Fill in required information:
   - **App name**: Your application name
   - **User support email**: Your support email
   - **Developer contact information**: Your contact email

*📸 Screenshot indicator: OAuth consent screen configuration form*

### Step 4: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Select **Web application** as application type
4. Configure the following:
   - **Name**: `Supabase Auth` (or your preferred name)
   - **Authorized JavaScript origins**: `https://hrkznrcmotfdvyapbhim.supabase.co`
   - **Authorized redirect URIs**: `https://hrkznrcmotfdvyapbhim.supabase.co/auth/v1/callback`

*📸 Screenshot indicator: OAuth client ID creation form with callback URI*

### Step 5: Retrieve Client Credentials

1. After creation, you'll see a modal with your credentials
2. **Copy and securely store**:
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxx`

### Required Scopes for Google

Google OAuth automatically includes these scopes:
- `openid` - Basic authentication
- `email` - User's email address  
- `profile` - Basic profile information

### Environment Variables

Add to your `.env` file:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## GitHub OAuth Setup

### Step 1: Access GitHub Developer Settings

1. Log into [GitHub](https://github.com)
2. Click your profile picture (top-right) > **Settings**
3. In the left sidebar, scroll down to **Developer settings**
4. Click **OAuth Apps**

*📸 Screenshot indicator: GitHub Developer settings navigation*

### Step 2: Create New OAuth App

1. Click **New OAuth App** button
2. Fill in the application details:
   - **Application name**: Your app name
   - **Homepage URL**: `https://your-domain.com` (your main website)
   - **Application description**: Brief description of your app
   - **Authorization callback URL**: `https://hrkznrcmotfdvyapbhim.supabase.co/auth/v1/callback`

*📸 Screenshot indicator: GitHub OAuth App creation form*

### Step 3: Retrieve Client Credentials

1. After creation, you'll be redirected to your app's settings
2. **Copy and securely store**:
   - **Client ID**: Visible on the page
   - **Client Secret**: Click **Generate a new client secret** to create and view

### Required Scopes for GitHub

GitHub OAuth requests these scopes by default:
- `user:email` - Access to user's email addresses
- `read:user` - Read access to user's profile information

### Environment Variables

Add to your `.env` file:

```bash
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

---

## LinkedIn OAuth Setup

### Step 1: Access LinkedIn Developer Portal

1. Navigate to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Sign in with your LinkedIn account
3. Click **Create App** button

*📸 Screenshot indicator: LinkedIn Developer Portal dashboard*

### Step 2: Create LinkedIn App

1. Fill in the required information:
   - **App name**: Your application name
   - **LinkedIn Page**: Select your company page (or create one)
   - **App logo**: Upload a logo (PNG, minimum 100x100px)
   - **Legal agreement**: Accept the terms

*📸 Screenshot indicator: LinkedIn app creation form*

### Step 3: Configure OAuth Settings

1. After app creation, go to the **Auth** tab
2. In **OAuth 2.0 settings** section:
   - **Authorized redirect URLs**: Add `https://hrkznrcmotfdvyapbhim.supabase.co/auth/v1/callback`
3. In **OAuth 2.0 scopes**, ensure you have:
   - `r_liteprofile` (or `profile`)
   - `r_emailaddress` (or `email`)

*📸 Screenshot indicator: LinkedIn OAuth 2.0 settings configuration*

### Step 4: Retrieve Client Credentials

1. In the **Auth** tab, locate **Application credentials**
2. **Copy and securely store**:
   - **Client ID**: Displayed in the Application credentials section
   - **Client Secret**: Click on the Client Secret to reveal and copy

### Required Scopes for LinkedIn

LinkedIn OAuth requires these specific scopes:
- `profile` - Access to basic profile information
- `email` - Access to user's email address

### Environment Variables

Add to your `.env` file:

```bash
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

---

## Common Issues and Troubleshooting

### Invalid Redirect URI Errors

**Problem**: "redirect_uri_mismatch" or similar errors

**Solutions**:
1. ✅ Verify the callback URI is exactly: `https://hrkznrcmotfdvyapbhim.supabase.co/auth/v1/callback`
2. ✅ Check for trailing slashes, extra spaces, or typos
3. ✅ Ensure protocol is `https://` not `http://`
4. ✅ Confirm the URI is added to all required fields in each provider's console

### Invalid Client Credentials

**Problem**: "invalid_client" or authentication failures

**Solutions**:
1. ✅ Double-check Client ID and Client Secret are correctly copied
2. ✅ Verify no extra characters or spaces were included
3. ✅ Ensure environment variables are properly loaded
4. ✅ Confirm the OAuth app is not in a draft or disabled state

### Scope Permission Issues

**Problem**: Missing user information after successful authentication

**Solutions**:
1. ✅ Verify required scopes are properly configured
2. ✅ Check if additional scopes need approval (LinkedIn, Google)
3. ✅ Ensure your app has been approved for production use

### Google-Specific Issues

**Common Problems**:
- App is in testing mode with limited users
- Google+ API not enabled
- OAuth consent screen not published

**Solutions**:
1. ✅ Publish your OAuth consent screen for production use
2. ✅ Enable all required Google APIs
3. ✅ Add test users if app is in testing mode

### GitHub-Specific Issues

**Common Problems**:
- Organization restrictions preventing OAuth
- Email privacy settings blocking email access

**Solutions**:
1. ✅ Check if user's organization allows third-party OAuth
2. ✅ Request `user:email` scope explicitly if needed

### LinkedIn-Specific Issues

**Common Problems**:
- Company page required for app creation
- Limited scopes for new applications
- Review process for additional permissions

**Solutions**:
1. ✅ Create a LinkedIn company page if you don't have one
2. ✅ Apply for additional scopes if basic ones aren't sufficient
3. ✅ Wait for LinkedIn review process to complete

---

## Testing Your OAuth Configuration

### Step 1: Test Authentication Flow

1. Navigate to your application's login page
2. Click on each OAuth provider button
3. Complete the authentication flow
4. Verify user information is correctly retrieved

### Step 2: Verify User Data

Ensure the following data is accessible after authentication:
- ✅ User's email address
- ✅ User's display name
- ✅ User's profile picture (if required)
- ✅ Any additional profile information needed

### Step 3: Test Error Scenarios

1. Test with invalid credentials
2. Test with user who denies permissions
3. Test callback URI handling
4. Verify error messages are user-friendly

### Step 4: Monitor OAuth Logs

1. Check Supabase Auth logs for any errors
2. Monitor provider-specific logs in their consoles
3. Verify successful authentication events

---

## Security Best Practices

### Credential Management

- ✅ Never commit OAuth credentials to version control
- ✅ Use environment variables for all secrets
- ✅ Rotate client secrets periodically
- ✅ Monitor for any credential exposure

### Scope Minimization

- ✅ Request only the minimum scopes required
- ✅ Document why each scope is necessary
- ✅ Regularly review and remove unused scopes

### Error Handling

- ✅ Implement proper error handling for OAuth failures
- ✅ Provide clear user feedback for authentication issues
- ✅ Log errors securely without exposing sensitive data

---

## Next Steps

After completing OAuth setup:

1. **Configure Supabase**: Add your OAuth credentials to Supabase Auth settings
2. **Implement Frontend**: Add OAuth buttons to your application's login interface
3. **Test Thoroughly**: Verify all providers work correctly in your environment
4. **Monitor Usage**: Set up monitoring for authentication success/failure rates

For additional help, refer to:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [LinkedIn OAuth Documentation](https://docs.microsoft.com/en-us/linkedin/shared/authentication/)

---

*Last updated: January 2025*