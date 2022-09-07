import React from 'react';
import logo from '../logo-large.png';
import './Homepage.css';

const Homepage: React.FC = () => {
	return <>
		<h1>SC Catchers</h1>
		<img src={logo} className="App-logo" alt="logo" />
		<blockquote className='blockquote'>
			Vítejte na stránkách SC Catchers, týmu 8. Hanspaulské ligy.
			V této soutěži působíme od podzimu roku 2004. Zakládajícími členy
			byla parta kamarádu z Gymnázia Písnická. Zdaleka ne všichni v týmu
			setrvali, ale našli se jiní a tak jsme tu stále. Největším úspěchem
			našeho týmu bylo umístění na 5. místě. Naším hlavním cílem je postup do 7. ligy
			a především bavit se fotbalem, nehádat se na hřišti a udělat si chuť na dobré pivo.
		</blockquote>
	</>;
};
export default Homepage;
