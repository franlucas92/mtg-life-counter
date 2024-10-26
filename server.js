// server.js
const { createServer } = require('http');
const next = require('next');
const socketIo = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

let gameState = null; // Estado de la partida

let availableColors = [
	"#ff5733", // Rojo anaranjado
	"#33c1ff", // Azul brillante
	"#ff33f6", // Rosa fuerte
	"#33ff57", // Verde brillante
	"#ffbd33", // Naranja vibrante
	"#ff33a6", // Rosa neón
	"#3357ff", // Azul neón
	"#a633ff", // Púrpura
	"#33ffeb", // Cian
	"#ff5733", // Rojo vivo
	"#f033ff", // Magenta
	"#33ff8e", // Verde lima
	"#33ffbd", // Verde menta
	"#f5a623", // Amarillo anaranjado
	"#e91e63", // Rosa intenso
	"#9c27b0", // Púrpura oscuro
	"#673ab7", // Indigo
	"#03a9f4", // Azul celeste
	"#00bcd4", // Turquesa
	"#009688"  // Verde azulado
];





app.prepare().then(() =>
{
	const server = createServer((req, res) =>
	{
		handle(req, res);
	});

	const io = socketIo(server);

	io.on('connection', (socket) =>
	{
		console.log('Nuevo cliente conectado');

		socket.on('ping', () =>
		{
			// Puedes agregar lógica aquí si lo deseas
			console.log(`Ping recibido de ${socket.id}`);
		});

		// Enviar el estado inicial al cliente
		socket.emit('gameState', gameState);

		// Crear una nueva partida
		socket.on('createGame', (numPlayers) =>
		{
			if(!gameState)
			{
				gameState = {
					numPlayers,
					players: [],
					startingPlayer: null,
				};
				// Reiniciar los colores disponibles
				availableColors = [
					"#ff5733", // Rojo anaranjado
					"#33c1ff", // Azul brillante
					"#ff33f6", // Rosa fuerte
					"#33ff57", // Verde brillante
					"#ffbd33", // Naranja vibrante
					"#ff33a6", // Rosa neón
					"#3357ff", // Azul neón
					"#a633ff", // Púrpura
					"#33ffeb", // Cian
					"#ff5733", // Rojo vivo
					"#f033ff", // Magenta
					"#33ff8e", // Verde lima
					"#33ffbd", // Verde menta
					"#f5a623", // Amarillo anaranjado
					"#e91e63", // Rosa intenso
					"#9c27b0", // Púrpura oscuro
					"#673ab7", // Indigo
					"#03a9f4", // Azul celeste
					"#00bcd4", // Turquesa
					"#009688"  // Verde azulado
				];
				io.emit('gameState', gameState);
			} else
			{
				socket.emit('errorMessage', 'Ya hay una partida en curso.');
			}
		});


		const sqlite3 = require('sqlite3').verbose();

		// Manejar la búsqueda de cartas
		socket.on('searchCard', (cardName, callback) =>
		{
			searchCardByName(cardName, (err, cards) =>
			{
				console.log(cardName,cards);
				if(err)
				{
					callback({ error: 'Error al buscar la carta' });
				} else
				{
					callback({ cards });
				}
			});
		});



		function searchCardByName(cardName, callback) {
			const db = new sqlite3.Database('cards.db');
		  
			// Escapar caracteres especiales
			const escapedTerm = cardName.replace(/['"]/g, '');
		  
			// Usar la sintaxis FTS para búsquedas de prefijo
			const searchTerm = escapedTerm.trim().split(/\s+/).map(term => `${term}*`).join(' ');
		  
			const query = `SELECT * FROM cards WHERE name MATCH ? LIMIT 10`;
		  
			db.all(query, [searchTerm], (err, rows) => {
			  if (err) {
				console.error('Error en la consulta:', err.message);
				callback(err, null);
			  } else {
				callback(null, rows);
			  }
			  db.close();
			});
		  }
		  


		// Unirse a una partida
		socket.on('joinGame', ({ playerName, playerId, commander }) =>
		{
			if(gameState)
			{
				// Verificar si el playerId ya existe
				let player = gameState.players.find((p) => p.playerId === playerId);

				if(player)
				{
					// Actualizar socket.id
					player.id = socket.id;
					player.isDisconnected = false;
					console.log(`Jugador reconectado: ${player.name} (${playerId})`);
					socket.emit('playerData', player);
					io.emit('gameState', gameState);
				} else if(gameState.players.length < gameState.numPlayers)
				{
					// Asignar un color disponible
					let color;
					if(availableColors.length === 0)
					{
						color = '#cccccc'; // Color por defecto si no hay colores disponibles
					} else
					{
						const colorIndex = Math.floor(Math.random() * availableColors.length);
						color = availableColors.splice(colorIndex, 1)[0];
					}

					// Crear nuevo jugador
					player = {
						id: socket.id,
						playerId: playerId,
						name: playerName,
						life: 40,
						color: color,
						commanderDamage: {},
						isDead: false,
						isDisconnected: false,
						commanderImage: commander.image,
					};
					gameState.players.push(player);
					socket.emit('playerData', player);
					io.emit('gameState', gameState);

					// Elegir jugador inicial si todos se han unido
					if(gameState.players.length === gameState.numPlayers)
					{
						const startingPlayerIndex = Math.floor(Math.random() * gameState.numPlayers);
						gameState.startingPlayer = gameState.players[startingPlayerIndex].id;
						io.emit('gameState', gameState);
					}
				} else
				{
					socket.emit('errorMessage', 'La partida está llena.');
				}
			} else
			{
				socket.emit('errorMessage', 'No hay ninguna partida activa.');
			}
		});


		// Actualizar la vida del jugador
		socket.on('updateLife', ({ playerId, delta }) =>
		{
			if(gameState)
			{
				const player = gameState.players.find((p) => p.id === playerId);
				if(player)
				{
					player.life += delta;

					// Comprobar si el jugador ha muerto o revivido
					if(player.life <= 0)
					{
						player.isDead = true;
					} else
					{
						player.isDead = false;
					}

					io.emit('gameState', gameState);
				}
			}
		});


		// Dentro del evento 'updateCommanderDamage'
		socket.on('updateCommanderDamage', ({ fromPlayerId, toPlayerId, damage }) =>
		{
			if(gameState)
			{
				const toPlayer = gameState.players.find((p) => p.id === toPlayerId);
				if(toPlayer)
				{
					const previousDamage = toPlayer.commanderDamage[fromPlayerId] || 0;
					const damageDelta = damage - previousDamage;

					// Actualizar el daño de comandante recibido
					toPlayer.commanderDamage[fromPlayerId] = damage;

					// Reducir la vida del jugador afectado
					toPlayer.life -= damageDelta;

					// Comprobar si el jugador ha muerto por vida <= 0
					if(toPlayer.life <= 0)
					{
						toPlayer.isDead = true;
						socket.emit('errorMessage', 'Has muerto.');
					}

					// Comprobar si el jugador ha recibido 21 o más puntos de daño de un mismo comandante
					// Después de actualizar el daño de comandante
					if(damage >= 21)
					{
						toPlayer.isDead = true;
						socket.emit('errorMessage', 'Has muerto por daño de comandante.');
					} else if(toPlayer.isDead && damage < 21)
					{
						// Revivir al jugador si estaba muerto por daño de comandante y ahora tiene menos de 21 de daño
						toPlayer.isDead = false;
						socket.emit('errorMessage', 'Has revivido.');
					}


					io.emit('gameState', gameState);
				}
			}
		});



		// Reiniciar la partida
		socket.on('resetGame', () =>
		{
			if(gameState)
			{
				gameState.players.forEach((player) =>
				{
					player.life = 40;
					player.commanderDamage = {};
					player.isDead = false;
				});

				// Elegir un nuevo jugador inicial
				const startingPlayerIndex = Math.floor(Math.random() * gameState.numPlayers);
				gameState.startingPlayer = gameState.players[startingPlayerIndex].id;

				io.emit('gameState', gameState);
			}
		});

		// Manejar desconexión
		socket.on('disconnect', () =>
		{
			console.log(`Cliente desconectado: ${socket.id}`);
			if(gameState)
			{
				const disconnectedPlayer = gameState.players.find((p) => p.id === socket.id);
				if(disconnectedPlayer)
				{
					// Devolver el color al pool
					if(disconnectedPlayer.color && disconnectedPlayer.color !== '#cccccc')
					{
						availableColors.push(disconnectedPlayer.color);
					}
					// Marcar al jugador como desconectado
					disconnectedPlayer.isDisconnected = true;
				}

				// Comprobar si todos los jugadores están desconectados
				const allDisconnected = gameState.players.every((player) => player.isDisconnected);
				if(allDisconnected)
				{
					console.log('Todos los jugadores se han desconectado. Eliminando la partida.');
					gameState = null;
					availableColors = []; // Reiniciar los colores disponibles
				}

				io.emit('gameState', gameState);
			}
		});




	});
	const port = process.env.PORT || 3000;
	server.listen(port, (err) =>
	{
		if(err) throw err;
		console.log(`> Servidor listo en http://localhost:${port}`);
	});
});

