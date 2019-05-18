import React, { useState } from 'react';
import classNames from 'classnames';
import logo from './logo.png';
import './App.css';
import Anchor from './Components/Anchor';

const pages = [
	{
		name: 'SC Catchers',
		path: '/',
		render: () => <>
			<h1>SC Catchers</h1>
			<img src={logo} className="App-logo" alt="logo" />
		</>,
		hiddenInMenu: true,
	},
	{
		name: 'Zápasy',
		path: '/zapasy',
		render: () => <>
			<h1>Zápasy</h1>
			<img src={logo} className="App-logo" alt="logo" />
		</>,
	},
];

const App: React.FC = () => {
	const [menuOpen, setMenuOpen] = useState(false);
	const [currentPath, changePath] = useState(window.location.pathname);
	window.onpopstate = window.history.onpushstate = () => setTimeout(() => changePath(window.location.pathname));
	const currentPage = pages.find((page) => page.path === currentPath);
	return (
		<div className="App">
			<header className="App-header">
				<nav className="navbar navbar-expand-lg navbar-light bg-light">
					<Anchor className="navbar-brand" href="/">SC Catchers</Anchor>
					<button className="navbar-toggler" type="button" onClick={() => setMenuOpen(!menuOpen)}>
						<span className="navbar-toggler-icon"></span>
					</button>

					<div className="collapse navbar-collapse" style={{ display: menuOpen ? 'block' : 'none' }}>
						<ul className="navbar-nav mr-auto">
							{pages.filter((page) => !page.hiddenInMenu).map((page) => (
								<li key={page.path} className={classNames("nav-item", {
									'active': page.path === currentPath,
								})}>
									<Anchor
										className="nav-link"
										href={page.path}
									>
										{page.name}
										{page.path === currentPath ? <span className="sr-only">(current)</span> : null}
									</Anchor>
								</li>
							))}
						</ul>
					</div>
				</nav>
			</header>
			<section className="container App-content">
				{currentPage ? (
					currentPage.render && currentPage.render()
				) : (
					<>
						<h1>SC Catchers - Stránka nenalezena</h1>
						<p>Tato stránka nebyla nalezena. Prosím pokračuj na <Anchor href="/">stránce týmu</Anchor></p>
						<img src={logo} className="App-logo" alt="logo" />
					</>
				)}
			</section>
			<footer className="App-footer"></footer>
		</div>
	);
}

export default App;
