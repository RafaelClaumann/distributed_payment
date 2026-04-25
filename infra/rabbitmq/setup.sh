#!/bin/bash
set -e

HOST=${RABBITMQ_HOST:-rabbitmq}
USER=${RABBITMQ_USER:-admin}
PASS=${RABBITMQ_PASS:-admin}

echo ">>> Aguardando RabbitMQ ficar disponível..."
until rabbitmqadmin -H $HOST -u $USER -p $PASS list queues &>/dev/null; do
  sleep 2
done

echo ">>> Criando exchange..."
rabbitmqadmin -H $HOST -u $USER -p $PASS \
  declare exchange name=payment.exchange type=direct durable=true

echo ">>> Criando Dead Letter Queue..."
rabbitmqadmin -H $HOST -u $USER -p $PASS \
  declare queue name=payment.dlq durable=true

echo ">>> Criando filas..."
rabbitmqadmin -H $HOST -u $USER -p $PASS \
  declare queue name=payment.request durable=true

rabbitmqadmin -H $HOST -u $USER -p $PASS \
  declare queue name=payment.result durable=true \
  arguments='{"x-dead-letter-exchange":"","x-dead-letter-routing-key":"payment.dlq"}'

echo ">>> Criando bindings..."
rabbitmqadmin -H $HOST -u $USER -p $PASS \
  declare binding source=payment.exchange destination=payment.request routing_key=payment.request

rabbitmqadmin -H $HOST -u $USER -p $PASS \
  declare binding source=payment.exchange destination=payment.result routing_key=payment.result

echo ">>> Setup concluído!"
