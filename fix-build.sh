#!/bin/bash
# Script para instalar packages e corrigir erros de build

set -e

cd /home/lucas/Documentos/ktagman2.0/ktagmanagement

echo "📦 Instalando packages faltantes..."
npm install react-leaflet-cluster react-icons @types/react-icons

echo "✅ Packages instalados"
