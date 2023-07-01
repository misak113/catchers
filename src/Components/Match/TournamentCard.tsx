import React from 'react';
import { getPSMFGroupUrl, getPSMFTournamentUrl } from '../../Model/psmfFacade';

interface IProps {
	tournament: string | undefined;
	group: string | undefined;
}

function TournamentCard(props: IProps) {
	return (
		<div className="card">
			<div className="card-header">
				Soutěž
			</div>
			<div className="card-body">
				<blockquote className="blockquote mb-0">
					{props.tournament ? <p>
						<a href={getPSMFTournamentUrl(props.tournament)} target='_blank' rel="noreferrer">
							<span className="fa fa-external-link icon-external"/> {props.tournament}
						</a>
					</p> : 'Neuvedena'}
					{props.tournament && props.group && <p>
						<a href={getPSMFGroupUrl(props.tournament, props.group)} target='_blank' rel="noreferrer">
							<span className="fa fa-external-link icon-external"/> {props.group}
						</a>
					</p>}
				</blockquote>
			</div>
		</div>
	);
}
export default TournamentCard;
