import React from 'react';
import classNames from 'classnames';
import './Attendees.css';
import Loading from '../Loading';
import { IPersonResult, IUser } from '../../Model/collections';
import { createMapPersonResultToUser, getUnrespondedUsers, getUserName } from '../../Model/userFacade';

interface IProps {
	attendees: IPersonResult[];
	maybeAttendees: IPersonResult[];
	nonAttendees: IPersonResult[];
	possibleAttendees?: IUser[];
	children?: React.ReactNode;
}

interface IPopoverProps {
	title: string;
	className: string;
	people: IUser[];
}

const AttendeesDetailPopover = (props: IPopoverProps) => {
	return <div className="PeoplePopover popover fade show bs-popover-bottom">
		<div className="arrow"></div>
		<h3 className={classNames("popover-header", props.className)}>{props.title}</h3>
		<div className="popover-body">
			{props.people.map((person) => (
				<div key={person.id}>{getUserName(person)}</div>
			))}
		</div>
	</div>
};

const Attendees = (props: IProps) => {
	const mapPersonResultToUser = createMapPersonResultToUser(props.possibleAttendees);
	const unrespondedUsers = getUnrespondedUsers(props);
	return <div>
		{props.children}
		<span className="Attendees confirmed">
			<span className="badge badge-success">{props.attendees.length}</span>
			{props.attendees.length > 0 && <AttendeesDetailPopover title='Potvrzení' className="bg-success text-white" people={props.attendees.map(mapPersonResultToUser)}/>}
		</span>
		{props.maybeAttendees.length > 0 && <span className="Attendees maybe">
			<span className="badge badge-warning">{props.maybeAttendees.length}</span>
			<AttendeesDetailPopover title='Možná' className="bg-warning" people={props.maybeAttendees.map(mapPersonResultToUser)}/>
		</span>}
		<span className="Attendees declined">
			<span className="badge badge-danger">{props.nonAttendees.length}</span>
			{props.nonAttendees.length > 0 && <AttendeesDetailPopover title="Odmítnutí" className="bg-danger text-white" people={props.nonAttendees.map(mapPersonResultToUser)}/>}
		</span>
		<span className="Attendees waiting">
			{props.possibleAttendees
				? <>
					<span className="badge badge-secondary">{unrespondedUsers.length}</span>
					{unrespondedUsers.length > 0 && <AttendeesDetailPopover title="Nevyjádření" className="" people={unrespondedUsers}/>}
				</>
				: <span className="badge badge-secondary"><Loading size='9px'/></span>
			}
		</span>
	</div>
};
export default Attendees;
