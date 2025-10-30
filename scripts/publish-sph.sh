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

# Modify package.json for @sphtech-platform
echo "✏️  Modifying package.json for @sphtech-platform..."
jq '
  .name = "@sphtech-platform/chrome-devtools-mcp" |
  .description = "MCP server for Chrome DevTools (SPH custom fork with active page tracking)" |
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

# Build
echo "🔨 Building..."
npm run build

# Publish
echo "🚀 Publishing to GitHub Packages..."
npm publish

# Restore original package.json
echo "♻️  Restoring original package.json..."
mv package.json.backup package.json

echo ""
echo "✅ Successfully published @sphtech-platform/chrome-devtools-mcp!"
