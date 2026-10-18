import { ShiftBoardScreen } from '@/features/shifts/screens/shift-board-screen';

/** Schichtbörse außerhalb der Tabs (für die Küche, deren Tabs sie nicht enthalten). */
export default function ShiftBoardRoute() {
  return <ShiftBoardScreen standalone />;
}
