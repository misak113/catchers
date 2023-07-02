import React from 'react';
import { useTeamName } from "../../Model/psmfFacade";

type Props = {
	tournament: string | undefined;
	group: string | undefined;
	code: string;
};

export const TeamName = (props: Props) => {
	const teamName = useTeamName(props);
	if (!teamName) {
		return <>{props.code}</>;
	}

	return <>{teamName}</>;
};
