require('dotenv').config()

const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Tamanho do pool
  min:     2,   // conexões mínimas mantidas abertas
  max:     10,  // conexões máximas simultâneas

  // Timeouts
  connectionTimeoutMillis: 3000,  // tempo máximo para obter uma conexão do pool
  idleTimeoutMillis:       30000, // tempo até fechar conexão ociosa
  statement_timeout:       10000, // tempo máximo de execução de uma query
})

pool.on('error', (err) => {
  console.error('Erro inesperado na conexão ociosa:', err)
  process.exit(-1)
})

pool.connect()
  .then(client => {
    console.log('PostgreSQL conectado com sucesso')
    client.release()
  })
  .catch(err => {
    console.error('Erro ao conectar no PostgreSQL:', err)
    process.exit(-1)
  })

const query = (text, params) => pool.query(text, params)

module.exports = { query }
