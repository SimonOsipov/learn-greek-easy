#!/bin/bash
#
# Setup script for pre-commit hooks
# Run this once after cloning the repository
#
set -e

echo "=========================================="
echo "  Learn Greek Easy - Pre-commit Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the repository root
if [ ! -f ".pre-commit-config.yaml" ]; then
    echo -e "${RED}Error: .pre-commit-config.yaml not found.${NC}"
    echo "Please run this script from the repository root."
    exit 1
fi

# Check if pre-commit is installed
echo "Checking for pre-commit installation..."
if ! command -v pre-commit &> /dev/null; then
    echo -e "${YELLOW}pre-commit not found. Installing...${NC}"

    # Try pip first, then pipx
    if command -v pipx &> /dev/null; then
        pipx install pre-commit
    elif command -v pip &> /dev/null; then
        pip install pre-commit
    elif command -v pip3 &> /dev/null; then
        pip3 install pre-commit
    else
        echo -e "${RED}Error: No pip/pipx found. Please install pre-commit manually:${NC}"
        echo "  pip install pre-commit"
        echo "  OR"
        echo "  brew install pre-commit"
        exit 1
    fi
fi

echo -e "${GREEN}✓ pre-commit is installed${NC}"
pre-commit --version
echo ""

# Install the git hooks
echo "Installing git hooks..."
pre-commit install
echo -e "${GREEN}✓ Git hooks installed${NC}"
echo ""

# Check if frontend dependencies are installed
echo "Checking frontend dependencies..."
if [ -d "learn-greek-easy-frontend/node_modules" ]; then
    echo -e "${GREEN}✓ Frontend node_modules exists${NC}"
else
    echo -e "${YELLOW}Warning: Frontend dependencies not installed.${NC}"
    echo "  Run: cd learn-greek-easy-frontend && npm install"
fi
echo ""

# Check if backend dependencies are installed
echo "Checking backend dependencies..."
if [ -d "learn-greek-easy-backend/.venv" ]; then
    echo -e "${GREEN}✓ Backend virtual environment exists${NC}"
else
    echo -e "${YELLOW}Warning: Backend virtual environment not found.${NC}"
    echo "  Run: cd learn-greek-easy-backend && poetry install"
fi
echo ""

# Ask if user wants to run hooks on all files
echo "=========================================="
read -p "Run pre-commit on all files now? (recommended for first setup) [y/N] " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running pre-commit on all files..."
    echo "(This may take a few minutes the first time)"
    echo ""
    pre-commit run --all-files || true
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Pre-commit hooks will now run automatically on every commit."
echo ""
echo "Useful commands:"
echo "  pre-commit run              # Run on staged files"
echo "  pre-commit run --all-files  # Run on all files"
echo "  pre-commit autoupdate       # Update hook versions"
echo "  git commit --no-verify      # Skip hooks (use sparingly)"
echo "=========================================="
