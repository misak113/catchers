import React from 'react';
import Loading from '../Loading';
import { getPSMFTournamentUrl } from '../../Model/psmfFacade';

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
					<p>
						<a href={getPSMFTournamentUrl(props.tournament)} target='_blank' rel="noreferrer">
							<span className="fa fa-external-link"/> {props.tournament}
						</a>
					</p>
				</blockquote>
				: <Loading/>}
			</div>
		</div>
	);
}
export default TournamentCard;
