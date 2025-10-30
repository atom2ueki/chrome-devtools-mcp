#!/bin/bash
set -e

echo "📦 Publishing @sphtech-platform/chrome-devtools-mcp..."
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed"
    echo "   Install with: brew install jq"
    exit 1
fi

# Backup original package.json
echo "💾 Backing up package.json..."
cp package.json package.json.backup

# Get current version and increment patch version
CURRENT_VERSION=$(jq -r '.version' package.json)
echo "📌 Current version: $CURRENT_VERSION"

# Increment patch version (e.g., 0.9.0 -> 0.9.1)
NEW_VERSION=$(echo "$CURRENT_VERSION" | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')
echo "🔢 New version: $NEW_VERSION"

# Modify package.json for @sphtech-platform
echo "✏️  Modifying package.json for @sphtech-platform..."
jq --arg version "$NEW_VERSION" '
  .name = "@sphtech-platform/chrome-devtools-mcp" |
  .version = $version |
  .repository = {
    "type": "git",
    "url": "git+https://github.com/atom2ueki/chrome-devtools-mcp.git"
  } |
  .homepage = "https://github.com/atom2ueki/chrome-devtools-mcp#readme" |
  .bugs = {
    "url": "https://github.com/atom2ueki/chrome-devtools-mcp/issues"
  } |
  .publishConfig = {
    "registry": "https://npm.pkg.github.com",
    "@sphtech-platform:registry": "https://npm.pkg.github.com"
  } |
  .scripts.prepublishOnly = "npm run build"
' package.json > package.json.tmp

mv package.json.tmp package.json

# Build and bundle
echo "🔨 Building and bundling..."
npm run bundle

# Publish
echo "🚀 Publishing to GitHub Packages..."
npm publish

# Restore original package.json
echo "♻️  Restoring original package.json..."
mv package.json.backup package.json

echo ""
echo "✅ Successfully published @sphtech-platform/chrome-devtools-mcp!"
