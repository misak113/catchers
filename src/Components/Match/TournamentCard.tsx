import React from 'react';
import Loading from '../Loading';

interface IProps {
	tournament: string | undefined;
}

function TournamentCard(props: IProps) {
	return (
		<div className="card">
			<div className="card-header">
				Soutěž
			</div>
			<div className="card-body">
				{props.tournament
				? <blockquote className="blockquote mb-0">
					<p>{props.tournament}</p>
				</blockquote>
				: <Loading/>}
			</div>
		</div>
	);
}
export default TournamentCard;
