import React from 'react';
import Loading from '../Loading';
import { getPSMFTeamUrl } from '../../Model/psmfFacade';

interface IProps {
	tournament: string | undefined;
	group: string | undefined;
	opponent: string | undefined;
}

function TeamCard(props: IProps) {
	return (
		<div className="card">
			<div className="card-header">
				Soupeř
			</div>
			<div className="card-body">
				{props.opponent
				? <blockquote className="blockquote mb-0">
					<p>
						{props.tournament && props.group
							? <a href={getPSMFTeamUrl(props.tournament, props.group, props.opponent)} target='_blank' rel="noreferrer">
								<span className="fa fa-external-link icon-external"/> {props.opponent}
							</a>
							: props.opponent
						}
					</p>
				</blockquote>
				: <Loading/>}
			</div>
		</div>
	);
}
export default TeamCard;
