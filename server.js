// server.js
const { createServer } = require('http');
const next = require('next');
const socketIo = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

let gameState = null; // Estado de la partida
const availableColors = ['#ff4d4d', '#4dff4d', '#4d4dff', '#ffff4d', '#ff4dff', '#4dffff'];

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
					startingPlayer: null, // Para indicar quién empieza
				};
				io.emit('gameState', gameState);
			} else
			{
				socket.emit('errorMessage', 'Ya hay una partida en curso.');
			}
		});

		// Unirse a una partida
		socket.on('joinGame', (playerName) =>
		{
			if(gameState)
			{
				if(gameState.players.length < gameState.numPlayers)
				{
					const player = {
						id: socket.id,
						name: playerName,
						life: 40,
						color: getRandomColor(),
						commanderDamage: {}, // Daño de comandante
						isDead: false,       // Estado de vida
					};
					gameState.players.push(player);
					socket.emit('playerData', player);
					availableColors.splice(0, availableColors.length, ...['#ff4d4d', '#4dff4d', '#4d4dff', '#ffff4d', '#ff4dff', '#4dffff']);
					io.emit('gameState', gameState);

					// Dentro del evento 'joinGame'
					if(availableColors.length === 0)
					{
						// Si no hay colores disponibles, asignar un color por defecto
						player.color = '#cccccc';
					} else
					{
						// Asignar un color aleatorio de los disponibles
						const colorIndex = Math.floor(Math.random() * availableColors.length);
						player.color = availableColors.splice(colorIndex, 1)[0];
					}


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
		socket.on('updateLife', (life) =>
		{
			if(gameState)
			{
				const player = gameState.players.find((p) => p.id === socket.id);
				if(player)
				{
					player.life = life;

					// Comprobar si el jugador ha muerto
					if(player.life <= 0)
					{
						player.isDead = true;
						socket.emit('errorMessage', 'Has muerto.');
					} else if(player.isDead)
					{
						// Revivir al jugador si estaba muerto y ahora tiene vida positiva
						player.isDead = false;
						socket.emit('errorMessage', 'Has revivido.');
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
			if(gameState)
			{
				const disconnectedPlayer = gameState.players.find((p) => p.id === socket.id);
				if(disconnectedPlayer)
				{
					// Devolver el color al pool
					availableColors.push(disconnectedPlayer.color);
					// Remover al jugador de la partida
					gameState.players = gameState.players.filter((p) => p.id !== socket.id);
				}
				if(gameState.players.length === 0)
				{
					gameState = null; // Reiniciar el estado si no hay jugadores
				} else
				{
					io.emit('gameState', gameState);
				}
			}
			console.log('Cliente desconectado');
		});

	});
	const port = process.env.PORT || 3000;
	server.listen(port, (err) =>
	{
		if(err) throw err;
		console.log(`> Servidor listo en http://localhost:${port}`);
	});
});

// Función para generar un color aleatorio
function getRandomColor()
{
	const colors = ['#ff4d4d', '#4dff4d', '#4d4dff', '#F7B44F', '#ff4dff', '#4dffff'];
	return colors[Math.floor(Math.random() * colors.length)];
}
