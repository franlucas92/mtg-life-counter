// pages/_document.js
import Document, { Html, Head, Main, NextScript } from 'next/document';
import React from 'react';
class MyDocument extends Document
{
	render()
	{
		return (
			<Html>
				<Head>
					<meta name="viewport" content="width=device-width, initial-scale=1.0" />
					<link rel="preconnect" href="https://fonts.googleapis.com" />
					<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
					<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet" />
				</Head>
				<body>
					<Main />
					<NextScript />
				</body>
			</Html>
		);
	}
}

export default MyDocument;
