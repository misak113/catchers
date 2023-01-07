import React from 'react';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import logo from '../logo-large.png';
import './Homepage.css';

const Homepage: React.FC<IAuthValue> = (props: IAuthValue) => {
	return <div className='Homepage'>
		<h1>SC Catchers</h1>
		{!props.auth.user && <blockquote className='blockquote jumbotron'>
			<p>
				Pokud seš tady poprvé, tak se nejprve budeš muset <strong>zaregistrovat</strong>.
			</p>
			<p>
				Zvol si libovolný způsob v pravo nahoře v menu.<br/>
				Je k dispozici jednoduchá varianta pomocí tlačítka, skrze <strong>Facebook</strong>.<br/>
				Pokud ti tato služba není po chuti, můžeš využít klasickou registraci pomocí <strong>e-mailové schránky</strong> a <strong>hesla</strong>, které si sám zvolíš. Použij libovolnou e-mailovou adresu, kterou rád používáš <i>(nemusí se shodovat s původníma stránkama)</i>.
			</p>
			<p>
				Po prvním přihlášení se <strong>nelekej!</strong> Zobrazí se ti <strong>dialogové okénko</strong>, ve kterém budeš muset kliknout na řádek se svým jménem.
				Je totiž potřeba tě identifikovat. Po kliknutí ti přijde e-mail na tvou původní e-mailovou adresu ze starých stránek, kde <strong>proklikneš odkaz</strong> a hotovo! Dál už tě nebudu otravovat.
			</p>
		</blockquote>}

		<img src={logo} className="App-logo" alt="logo" />
		<blockquote className='blockquote'>
			<p>
				SC Catchers tě vítá na svých oficiálních stránkách. Stránky se v našem týmu používají především na <strong>přihlašování na zápasy</strong>.
			</p>
			<p>
				Po přihlášení je k dispozici sekce <strong>"Zápasy"</strong> a v ní seznam všech zápasů pro aktuálně probíhající sezónu Hanspaulské ligy.<br/>
				Pokud zrovna neprobíhá sezóna, tak neleníme a účastníme se různých turnajů a soutěží. Mezi ně patří například letní/zimní turnaj HL anebo Memoriál Marka Šišáka.
				Všechny najdeš také v sekci "Zápasy".
			</p>
			<p>
				Při přihlášování na zápasy nezapomeň <strong>přidat poznámku</strong>, pokud máš nějaké specifické komplikace (například, <i>že dorazíš později, budeš muset odejít dříve nebo že tě bolí noha</i> :) )
			</p>
		</blockquote>
		<h3>Něco z historie</h3>
		<blockquote className='blockquote history'>
			Vítejte na stránkách SC Catchers, týmu 8. Hanspaulské ligy.
			V této soutěži působíme od podzimu roku 2004. Zakládajícími členy
			byla parta kamarádu z Gymnázia Písnická. Zdaleka ne všichni v týmu
			setrvali, ale našli se jiní a tak jsme tu stále. Největším úspěchem
			našeho týmu bylo umístění na 5. místě. Naším hlavním cílem je postup do 7. ligy
			a především bavit se fotbalem, nehádat se na hřišti a udělat si chuť na dobré pivo.
		</blockquote>
		<blockquote className='blockquote history'>
			<p>
				V této sezoně se opět účasníme Hanspaulské ligy hrajeme ve skupině 8Q. Na začátku jsme bohužel zapomněli jednou
				odpískat zápas a proto naše současné postavení není dostatečné.
			</p>
			<p>
				Současnou tabulku naleznete na tablulka 8Q ligy případně pokud ještě nebude platná na tabulka 8Q ligy
			</p>
			<p>
				Veškeré informace o našich úspěších i neúspěších za minulé i tuto sezonu naleznete mezi komentáři k zápasům.
			</p>
		</blockquote>
	</div>;
};
export default withAuth(Homepage);
