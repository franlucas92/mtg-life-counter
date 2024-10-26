// extractCardsToSQLite.js
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

async function extractCardsToSQLite() {
  const data = JSON.parse(fs.readFileSync('AllPrintings.json', 'utf8'));
  const sets = data.data;

  // Configurar la base de datos SQLite
  const db = new sqlite3.Database('cards.db');

  db.serialize(() => {
    // Crear la tabla FTS
    db.run('CREATE VIRTUAL TABLE IF NOT EXISTS cards USING fts5(id, name, image)');

    // Iniciar una transacción
    db.run('BEGIN TRANSACTION');

    const stmt = db.prepare('INSERT INTO cards (id, name, image) VALUES (?, ?, ?)');

    // Añadir un conjunto para rastrear los nombres insertados (para evitar duplicados)
    const insertedNames = new Set();

    for (const setCode in sets) {
      const set = sets[setCode];
      const cards = set.cards;

      cards.forEach((card) => {
        // Verificar la propiedad correcta para el tipo
        const typeLine = card.type || card.type_line || '';
        if (typeLine.includes('Legendary') && typeLine.includes('Creature')) {
          // Intentar obtener el scryfallId
          const scryfallId = card.identifiers?.scryfallId || card.scryfallId;

          if (scryfallId) {
            // Verificar si el nombre ya ha sido insertado
            if (!insertedNames.has(card.name)) {
              insertedNames.add(card.name);

              // Construir la URL de la imagen con 'version=art_crop'
              const imageUrl = `https://api.scryfall.com/cards/${scryfallId}?format=image&version=art_crop`;

              const cardInfo = {
                name: card.name,
                id: card.uuid || card.id,
                image: imageUrl,
              };

              // Insertar en la base de datos
              stmt.run(cardInfo.id, cardInfo.name, cardInfo.image, (err) => {
                if (err) {
                  console.error('Error al insertar la carta:', err.message);
                }
              });
            }
          } else {
            console.warn(`No se encontró scryfallId para la carta: ${card.name}`);
          }
        }
      });
    }

    stmt.finalize();

    // Finalizar la transacción
    db.run('COMMIT', () => {
      db.close();
      console.log('Datos de las cartas extraídos y guardados en cards.db');
    });
  });
}

extractCardsToSQLite();
