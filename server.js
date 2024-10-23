// server.js
const { createServer } = require('http');
const next = require('next');
const socketIo = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

let gameState = null; // Estado de la partida
const availableColors2 = [
	'#ff4d4d', // Rojo
	'#A3D9A5', // Verde suave
	'#A5B8D9', // Azul suave
	'#F0C78A', // Amarillo suave
	'#D3A5D9', // Morado suave
	'#A5D9D9', // Cian suave
	'#E9B8B8', // Rosa suave
	'#B8E9E1', // Aguamarina suave
	'#E9D7B8', // Arena suave
	'#C1D9E9', // Azul cielo suave
	'#D1E9B8', // Lima suave
	'#E9C1B8', // Coral suave
	'#D9A5A5', // Salmón suave
	'#B8E9C1', // Verde menta suave
	'#B8D1E9', // Azul hielo suave
	'#E9B8D7', // Rosa claro suave
	'#B8C1E9', // Lavanda suave
	'#D9C1E9', // Lila suave
	'#A5D3D9', // Azul grisáceo suave
	'#D9B8A5', // Naranja pálido suave
  ];

  const availableColors = [
	'#FF6666', // Rojo satinado
	'#66FFB3', // Verde satinado
	'#66B3FF', // Azul satinado
	'#FFD966', // Amarillo satinado
	'#FF66FF', // Magenta satinado
	'#66FFFF', // Cian satinado
	'#FFA366', // Naranja satinado
	'#C266FF', // Púrpura satinado
	'#FF668C', // Rosa satinado
	'#66FFCC', // Verde menta satinado
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
					availableColors.splice(0, availableColors.length, ...availableColors);
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
	const colors = availableColors;
	return colors[Math.floor(Math.random() * colors.length)];
}
