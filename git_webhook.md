# Git Production Deployment Setup - FAQ HIV/AIDS

This guide provides step-by-step instructions for setting up automatic deployment to a production server when pushing changes via Git.

## Overview

This setup allows you to deploy the FAQ HIV/AIDS PWA to a production server by pushing to a Git remote. The deployment is triggered automatically via a Git post-receive hook.

**Architecture:**
- Local repository → Push to production remote
- Production server receives push → Triggers post-receive hook
- Hook checks out files to web server directory

**Production URL:** https://faq-hiv-aids.bebot.co/

## Prerequisites

- SSH access to production server (root@173.249.16.84)
- Git installed on production server
- Web server configured (nginx/Apache)
- Domain configured: faq-hiv-aids.bebot.co

## Part 1: Local Setup

### Step 1: Navigate to Project Directory

```bash
cd "/Users/cpantin/Library/CloudStorage/GoogleDrive-colin@cpantin.com/My Drive/@Ministério da Saúde/OPAS 2026/40 anos da aids/dv_2025_cli/faq-hiv-aids"
```

### Step 2: Add Production Remote

Using the SSH config alias:

```bash
git remote add production contabo:/var/repo/faq-hiv-aids.git
```

**Note:** If you have an SSH config alias set up (like `contabo` pointing to `root@173.249.16.84`), use that instead of the full SSH URL for convenience.

### Step 3: Verify Remotes

```bash
git remote -v
```

Expected output:
```
origin      https://github.com/bacanapps/faq-hiv-aids.git (fetch)
origin      https://github.com/bacanapps/faq-hiv-aids.git (push)
production  contabo:/var/repo/faq-hiv-aids.git (fetch)
production  contabo:/var/repo/faq-hiv-aids.git (push)
```

## Part 2: Server Setup (Required Steps)

### Step 1: Connect to Production Server

```bash
ssh root@173.249.16.84
# Or using SSH alias:
ssh contabo
```

### Step 2: Create Bare Git Repository

A bare repository stores Git metadata without a working directory. It acts as a central hub for receiving pushes.

```bash
# Create directory for Git repositories (if not exists)
mkdir -p /var/repo

# Navigate to the directory
cd /var/repo

# Initialize bare repository for FAQ HIV/AIDS
git init --bare faq-hiv-aids.git
```

**Why bare repository?**
- Designed to receive pushes from multiple sources
- Doesn't have a working directory (only Git metadata)
- Standard practice for server-side Git repositories

### Step 3: Verify Deployment Directory

The deployment directory should already exist if the site is currently hosted:

```bash
# Check if directory exists
ls -la /var/www/faq-hiv-aids

# If it doesn't exist, create it
mkdir -p /var/www/faq-hiv-aids

# Set appropriate permissions
chown -R www-data:www-data /var/www/faq-hiv-aids
```

### Step 4: Create Post-Receive Hook

The post-receive hook is a script that runs automatically after Git receives a push.

**IMPORTANT:** Use POSIX-compliant syntax with single brackets `[` instead of double brackets `[[` to ensure compatibility.

```bash
# Create the hook file using cat with heredoc
cat > /var/repo/faq-hiv-aids.git/hooks/post-receive << 'EOF'
#!/bin/bash

# Configuration
TARGET="/var/www/faq-hiv-aids"
GIT_DIR="/var/repo/faq-hiv-aids.git"
BRANCH="main"

echo "===== Post-Receive Hook Started ====="

while read oldrev newrev ref
do
    # Extract branch name from ref
    RECEIVED_BRANCH=$(echo $ref | sed 's/refs\/heads\///')

    echo "Received push to branch: $RECEIVED_BRANCH"

    # Check if this is the main branch (use single brackets for POSIX compliance)
    if [ "$RECEIVED_BRANCH" = "$BRANCH" ]; then
        echo "Deploying $BRANCH branch to production..."
        echo "Target directory: $TARGET"

        # Checkout files to deployment directory
        git --work-tree=$TARGET --git-dir=$GIT_DIR checkout -f $BRANCH

        if [ $? -eq 0 ]; then
            echo "✓ Deployment successful!"
            echo "Files deployed to: $TARGET"

            # Set permissions
            chown -R www-data:www-data $TARGET

            # For faq-hiv-aids: Run Tailwind CSS build if needed
            if [ -f "$TARGET/package.json" ]; then
                echo "Running Tailwind CSS build..."
                cd $TARGET
                # Note: npm/node must be installed on server
                # Uncomment the following if you want auto-build:
                # npx tailwindcss -i ./tokens.css -o ./styles.css --minify
            fi

            echo "Service worker will be updated on next visit"
            echo "Site available at: https://faq-hiv-aids.bebot.co/"
        else
            echo "✗ Deployment failed!"
            exit 1
        fi
    else
        echo "Ignoring push to $RECEIVED_BRANCH branch (not $BRANCH)"
    fi
done

echo "===== Post-Receive Hook Completed ====="
EOF
```

**Note about TailwindCSS:** The faq-hiv-aids app uses TailwindCSS with a build step. You have two options:
1. Build locally before pushing (recommended for simplicity)
2. Build on server after deployment (requires Node.js/npm on server)

### Step 5: Make Hook Executable

```bash
chmod +x /var/repo/faq-hiv-aids.git/hooks/post-receive
```

**Verify permissions:**
```bash
ls -l /var/repo/faq-hiv-aids.git/hooks/post-receive
```

Should show: `-rwxr-xr-x` (executable)

### Step 6: Set Directory Permissions

```bash
# Git repository permissions
chown -R root:root /var/repo/faq-hiv-aids.git

# Web directory permissions (adjust user:group for your web server)
chown -R www-data:www-data /var/www/faq-hiv-aids

# Make directories readable
chmod -R 755 /var/www/faq-hiv-aids
```

**User/Group options:**
- Ubuntu/Debian nginx: `www-data:www-data`
- CentOS/RHEL nginx: `nginx:nginx`
- Apache: `www-data:www-data` or `apache:apache`

### Step 7: Verify Web Server Configuration

Check if nginx is configured for faq-hiv-aids.bebot.co:

```bash
# Check for existing configuration
ls -la /etc/nginx/sites-available/ | grep faq

# View the configuration
cat /etc/nginx/sites-available/faq-hiv-aids.bebot.co
# Or check sites-enabled
cat /etc/nginx/sites-enabled/faq-hiv-aids.bebot.co
```

**Expected nginx configuration:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name faq-hiv-aids.bebot.co;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name faq-hiv-aids.bebot.co;

    # SSL certificates (adjust paths as needed)
    ssl_certificate /etc/letsencrypt/live/faq-hiv-aids.bebot.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/faq-hiv-aids.bebot.co/privkey.pem;

    root /var/www/faq-hiv-aids;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|mp3)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker and manifest should not be cached
    location ~* (sw\.js|manifest\.json)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

If configuration doesn't exist, create it and enable:

```bash
nano /etc/nginx/sites-available/faq-hiv-aids.bebot.co
# Paste configuration above

# Enable site
ln -s /etc/nginx/sites-available/faq-hiv-aids.bebot.co /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload nginx
systemctl reload nginx
```

### Step 8: Test Connection from Local Machine

Exit the SSH session and return to your local machine:

```bash
exit
```

Test SSH connection:
```bash
ssh contabo "echo 'Connection successful'"
```

## Part 3: Deploying Changes

### TailwindCSS Build Process

Since faq-hiv-aids uses TailwindCSS, you need to build CSS before deploying:

```bash
# In your local faq-hiv-aids directory
cd "/Users/cpantin/Library/CloudStorage/GoogleDrive-colin@cpantin.com/My Drive/@Ministério da Saúde/OPAS 2026/40 anos da aids/dv_2025_cli/faq-hiv-aids"

# Build Tailwind CSS
npx tailwindcss -i ./tokens.css -o ./styles.css --minify

# Stage the built CSS
git add styles.css

# Commit if there are changes
git commit -m "Build Tailwind CSS for production"
```

### Option 1: Push to Production Only

```bash
git push production main
```

### Option 2: Push to GitHub Only

```bash
git push origin main
```

### Option 3: Push to Both Remotes (Recommended)

```bash
# Sequential push
git push origin main && git push production main
```

### Complete Deployment Workflow

```bash
# 1. Make changes to your code
# Edit files as needed

# 2. Build Tailwind CSS (if you modified tokens.css or HTML)
npx tailwindcss -i ./tokens.css -o ./styles.css --minify

# 3. Stage all changes
git add .

# 4. Commit changes
git commit -m "Update feature X"

# 5. Push to both GitHub and production
git push origin main && git push production main

# 6. Verify deployment
curl -I https://faq-hiv-aids.bebot.co/
```

### Option 4: Push to Multiple Remotes at Once

```bash
# Add to .git/config
git config -e
```

Add this section:

```ini
[remote "all"]
    url = https://github.com/bacanapps/faq-hiv-aids.git
    url = contabo:/var/repo/faq-hiv-aids.git
```

Then push to both:
```bash
git push all main
```

### Git Alias for Easy Deployment

Add to `~/.gitconfig`:

```ini
[alias]
    deploy = "!f() { \
        npx tailwindcss -i ./tokens.css -o ./styles.css --minify && \
        git add styles.css && \
        git commit -m 'Build CSS for production' || true && \
        git push origin main && \
        git push production main; \
    }; f"
```

Then use:
```bash
git deploy
```

## Workflow Example

**Complete deployment workflow:**

```bash
# 1. Navigate to project
cd "/Users/cpantin/Library/CloudStorage/GoogleDrive-colin@cpantin.com/My Drive/@Ministério da Saúde/OPAS 2026/40 anos da aids/dv_2025_cli/faq-hiv-aids"

# 2. Make changes to your code
# Edit app.js, tokens.css, etc.

# 3. Build Tailwind CSS
npx tailwindcss -i ./tokens.css -o ./styles.css --minify

# 4. Stage changes
git add .

# 5. Commit changes
git commit -m "Update FAQ content and styling"

# 6. Deploy to production
git push origin main && git push production main

# 7. Verify deployment
curl -I https://faq-hiv-aids.bebot.co/
open https://faq-hiv-aids.bebot.co/
```

## Troubleshooting

### Issue: Permission Denied

**Error:**
```
Permission denied (publickey,password)
```

**Solution:**
- Ensure SSH key is added to server's `~/.ssh/authorized_keys`
- Verify SSH config alias is working: `ssh contabo "echo test"`

### Issue: Hook Not Executing

**Error:**
Hook runs but files aren't deployed

**Solutions:**
```bash
# Check hook is executable
ssh contabo "ls -l /var/repo/faq-hiv-aids.git/hooks/post-receive"

# Check hook syntax
ssh contabo "bash -n /var/repo/faq-hiv-aids.git/hooks/post-receive"

# Manually test hook
ssh contabo "cd /var/repo/faq-hiv-aids.git && cat hooks/post-receive"
```

### Issue: Files Not Updating

**Possible causes:**
1. Wrong TARGET path in hook
2. Permission issues
3. Wrong branch name
4. CSS not built before pushing

**Debug:**
```bash
# Check current deployment
ssh contabo "ls -la /var/www/faq-hiv-aids"

# Check file modification times
ssh contabo "stat /var/www/faq-hiv-aids/index.html"

# Manually trigger deployment
ssh contabo "cd /var/repo/faq-hiv-aids.git && GIT_DIR=/var/repo/faq-hiv-aids.git git --work-tree=/var/www/faq-hiv-aids checkout -f main"
```

### Issue: CSS Not Updating

**Problem:** Tailwind CSS changes not reflecting on site

**Solution:**
```bash
# Always build CSS before committing
npx tailwindcss -i ./tokens.css -o ./styles.css --minify

# Verify styles.css was updated
git status

# Commit the built CSS
git add styles.css
git commit -m "Update CSS build"
git push origin main && git push production main
```

### Issue: Site Not Accessible

**Check SSL/Domain:**
```bash
# Test domain resolution
dig faq-hiv-aids.bebot.co

# Check nginx status
ssh contabo "systemctl status nginx"

# Check nginx error logs
ssh contabo "tail -50 /var/log/nginx/error.log"

# Test SSL certificate
curl -I https://faq-hiv-aids.bebot.co/
```

### Issue: Service Worker Caching Old Files

**Solution:**
Update version in `sw.js` to force cache refresh:

```javascript
const VERSION = "v2";  // Increment this
```

Then commit and push:
```bash
git add sw.js
git commit -m "Update service worker version"
git push origin main && git push production main
```

## Security Considerations

### 1. Use SSH Keys (Recommended)

```bash
# Generate SSH key locally (if not already done)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy to server
ssh-copy-id root@173.249.16.84
# Or using alias:
ssh-copy-id contabo
```

### 2. Restrict Hook Permissions

```bash
# Hook should only be writable by root
ssh contabo "chmod 755 /var/repo/faq-hiv-aids.git/hooks/post-receive"
ssh contabo "chown root:root /var/repo/faq-hiv-aids.git/hooks/post-receive"
```

### 3. HTTPS Configuration

Ensure SSL certificates are properly configured:

```bash
# Check SSL certificate expiry
ssh contabo "certbot certificates"

# Renew certificates if needed
ssh contabo "certbot renew"
```

### 4. Restrict SSH Access

Edit `/etc/ssh/sshd_config` to restrict access (be careful not to lock yourself out):

```bash
# Only allow specific users
AllowUsers deployer

# Disable root login (optional)
PermitRootLogin no

# Restart SSH
systemctl restart sshd
```

## Monitoring Deployments

### View Hook Logs

Add logging to hook (optional enhancement):

```bash
#!/bin/bash
LOG_FILE="/var/log/faq-hiv-aids-deploy.log"

# Redirect all output to log
exec >> $LOG_FILE 2>&1

echo "===== Deployment started at $(date) ====="
# ... rest of hook ...
echo "===== Deployment completed at $(date) ====="
```

View logs:
```bash
ssh contabo "tail -f /var/log/faq-hiv-aids-deploy.log"
```

### Monitor Site Status

```bash
# Check site is responding
curl -I https://faq-hiv-aids.bebot.co/

# Monitor nginx access logs
ssh contabo "tail -f /var/log/nginx/access.log | grep faq-hiv-aids"
```

## Advanced: Automated CSS Build on Server

If you want to build Tailwind CSS on the server after deployment:

**Prerequisites:**
- Node.js and npm installed on server

**Updated post-receive hook:**

```bash
#!/bin/bash
TARGET="/var/www/faq-hiv-aids"
GIT_DIR="/var/repo/faq-hiv-aids.git"
BRANCH="main"

while read oldrev newrev ref
do
    RECEIVED_BRANCH=$(echo $ref | sed 's/refs\/heads\///')

    if [ "$RECEIVED_BRANCH" = "$BRANCH" ]; then
        echo "Deploying $BRANCH branch to production..."

        # Checkout files
        git --work-tree=$TARGET --git-dir=$GIT_DIR checkout -f $BRANCH

        # Build Tailwind CSS
        echo "Building Tailwind CSS..."
        cd $TARGET
        npx tailwindcss -i ./tokens.css -o ./styles.css --minify

        # Set permissions
        chown -R www-data:www-data $TARGET

        echo "✓ Deployment complete!"
        echo "Site: https://faq-hiv-aids.bebot.co/"
    fi
done
```

**Note:** Building on server increases deployment time. Building locally is generally faster and more reliable.

## Resources

- [Git Hooks Documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [Deploying with Git](https://git-scm.com/book/en/v2/Git-on-the-Server-Getting-Git-on-a-Server)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [TailwindCSS CLI](https://tailwindcss.com/docs/installation)

## Summary Checklist

Server setup:
- [ ] SSH access confirmed
- [ ] Bare repository created at `/var/repo/faq-hiv-aids.git`
- [ ] Deployment directory verified at `/var/www/faq-hiv-aids`
- [ ] Post-receive hook created and made executable
- [ ] Permissions set correctly
- [ ] Web server configured for faq-hiv-aids.bebot.co
- [ ] SSL certificates configured
- [ ] First deployment tested

Local setup:
- [ ] Production remote added
- [ ] Tailwind CSS build workflow understood
- [ ] Test deployment completed
- [ ] Deployment workflow documented

Verification:
- [ ] Site accessible at https://faq-hiv-aids.bebot.co/
- [ ] CSS updates reflecting properly
- [ ] Service worker functioning
- [ ] Analytics tracking working

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review hook logs if logging is enabled
3. Test manual deployment via SSH
4. Verify web server and SSL configuration
5. Check domain DNS settings

## Quick Reference

```bash
# Build CSS locally
npx tailwindcss -i ./tokens.css -o ./styles.css --minify

# Complete deployment
git add . && git commit -m "Update" && git push origin main && git push production main

# Check deployment
ssh contabo "ls -la /var/www/faq-hiv-aids"

# View site
open https://faq-hiv-aids.bebot.co/

# Check nginx config
ssh contabo "nginx -t"

# Reload nginx
ssh contabo "systemctl reload nginx"
```
