#!/bin/bash
# Security Implementation Test Script
# Run this after implementing security fixes

echo "🔒 K-Tag Security Implementation Test Suite"
echo "==========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
PASSED=0
FAILED=0

# Test 1: Check .env.local exists
echo -n "1. Testing .env.local configuration... "
if [ -f ".env.local" ]; then
    if grep -q "VITE_JWT_SECRET" .env.local; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (JWT_SECRET not found)"
        ((FAILED++))
    fi
else
    echo -e "${RED}✗ FAILED${NC} (.env.local not found)"
    ((FAILED++))
fi

# Test 2: Check .gitignore protects .env files
echo -n "2. Testing .gitignore configuration... "
if grep -q "\.env\.local" .gitignore; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (.env.local not in .gitignore)"
    ((FAILED++))
fi

# Test 3: Check DOMPurify is installed
echo -n "3. Testing DOMPurify installation... "
if grep -q "dompurify" package.json; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (DOMPurify not installed)"
    ((FAILED++))
fi

# Test 4: Check security middleware exists
echo -n "4. Testing backend security middleware... "
if [ -f "functions/middleware/security.js" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (security.js not found)"
    ((FAILED++))
fi

# Test 5: Check JWT_SECRET not hardcoded
echo -n "5. Testing JWT_SECRET not hardcoded... "
if grep -q "ktag-pro-super-secret-key" services/jwt.ts; then
    echo -e "${RED}✗ FAILED${NC} (Hardcoded secret still present)"
    ((FAILED++))
else
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
fi

# Test 6: Check PBKDF2 iterations increased
echo -n "6. Testing PBKDF2 iterations (600k)... "
if grep -q "iterations: 600000" services/encryption.ts; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Iterations not updated)"
    ((FAILED++))
fi

# Test 7: Check xssProtection service exists
echo -n "7. Testing XSS protection service... "
if [ -f "services/xssProtection.ts" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (xssProtection.ts not found)"
    ((FAILED++))
fi

# Test 8: Check timing-safe comparison
echo -n "8. Testing timing-safe password comparison... "
if grep -q "result |=" services/security.ts; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Timing-safe comparison not implemented)"
    ((FAILED++))
fi

# Test 9: Check HTTPS validation function
echo -n "9. Testing HTTPS validation function... "
if grep -q "validateSecureUrl" services/security.ts; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (validateSecureUrl not found)"
    ((FAILED++))
fi

# Test 10: Check password minimum length
echo -n "10. Testing enhanced password generation... "
if grep -q "for (let i = 0; i < 8; i++)" services/security.ts; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Password length not updated)"
    ((FAILED++))
fi

# Test 11: Check implementation docs
echo -n "11. Testing implementation documentation... "
if [ -f "SECURITY_IMPLEMENTATION.md" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Documentation not found)"
    ((FAILED++))
fi

# Test 12: Check node_modules installed
echo -n "12. Testing dependencies installed... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Run npm install)"
    ((FAILED++))
fi

# Summary
echo ""
echo "==========================================="
echo "Test Results:"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
SCORE=$((PASSED * 100 / TOTAL))

if [ $SCORE -ge 90 ]; then
    echo -e "${GREEN}✅ Security Score: $SCORE% - EXCELLENT${NC}"
    exit 0
elif [ $SCORE -ge 75 ]; then
    echo -e "${YELLOW}⚠️  Security Score: $SCORE% - GOOD (some improvements needed)${NC}"
    exit 1
else
    echo -e "${RED}❌ Security Score: $SCORE% - NEEDS WORK${NC}"
    exit 1
fi
