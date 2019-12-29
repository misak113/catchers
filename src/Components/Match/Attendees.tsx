import React from 'react';
import classNames from 'classnames';
import './Attendees.css';
import Loading from '../Loading';
import { IPersonResult } from '../../Model/collections';

interface IProps {
	attendees: IPersonResult[];
	nonAttendees: IPersonResult[];
	possibleAttendees?: string[];
}

interface IPopoverProps {
	title: string;
	className: string;
	people: string[];
}

const AttendeesDetailPopover = (props: IPopoverProps) => (
	<div className="PeoplePopover popover fade show bs-popover-bottom">
		<div className="arrow"></div>
		<h3 className={classNames("popover-header", props.className)}>{props.title}</h3>
		<div className="popover-body">
			{props.people.map((person) => (
				<div key={person}>{person}</div>
			))}
		</div>
	</div>
);

const Attendees = (props: IProps) => (
	<div>
		<span className="Attendees confirmed">
			<span className="badge badge-success">{props.attendees.length}</span>
			{props.attendees.length > 0 && <AttendeesDetailPopover title='Potvrzení' className="bg-success text-white" people={props.attendees.map((person) => person.userId)}/>}
		</span>
		<span className="Attendees declined">
			<span className="badge badge-danger">{props.nonAttendees.length}</span>
			{props.nonAttendees.length > 0 && <AttendeesDetailPopover title="Odmítnutí" className="bg-danger text-white" people={props.nonAttendees.map((person) => person.userId)}/>}
		</span>
		<span className="Attendees waiting">
			{props.possibleAttendees
				? <>
					<span className="badge badge-secondary">{props.possibleAttendees.length - props.nonAttendees.length - props.attendees.length}</span>
					{props.possibleAttendees.length > 0 && <AttendeesDetailPopover title="Nevyjádření" className="" people={props.possibleAttendees}/>}
				</>
				: <span className="badge badge-secondary"><Loading/></span>
			}
		</span>
	</div>
);
export default Attendees;
