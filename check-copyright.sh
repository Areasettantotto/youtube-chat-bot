#!/bin/bash
# Copyright Integrity Checker
# © 2025 Marco Busato - All Rights Reserved

echo "🔍 Verifying copyright integrity..."
echo "📅 Check date: $(date -u)"
echo "👤 Original author: Marco Busato"
echo "📧 Contact: areasettantotto@icloud.com"
echo ""

# Check for required copyright files
FILES=("LICENSE" "README.md" "COMMIT_DECLARATION.md" ".github/LEGAL_NOTICE.md")

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing - COPYRIGHT VIOLATION!"
        exit 1
    fi
done

# Check for copyright notices in source files
if grep -q "Marco Busato" index.js; then
    echo "✅ Copyright notice in index.js"
else
    echo "❌ Missing copyright in index.js"
    exit 1
fi

echo ""
echo "✅ All copyright protections verified"
echo "🛡️ Repository is properly protected"
