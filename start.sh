#!/bin/bash

set -e  # para o script se der erro

echo "🚀 Subindo ambiente (RabbitMQ + PostgreSQL + pgAdmin)..."

# entra na pasta infra
cd infra

# verifica se docker está rodando
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker não está rodando. Inicie o Docker e tente novamente."
  exit 1
fi

# sobe os containers
docker compose up -d

echo "✅ Ambiente iniciado com sucesso!"
echo ""
echo "🌐 Acessos:"
echo "RabbitMQ: http://localhost:15672 (admin/admin)"
echo "pgAdmin:  http://localhost:5050 (admin@admin.com/admin)"
