import { Alert } from './alert.entity';
import { Classification } from './classification.entity';
import { Forecast } from './forecast.entity';
import { ReadingFiltered } from './reading-filtered.entity';
import { ReadingRaw } from './reading-raw.entity';
import { SensorNode } from './sensor-node.entity';
import { SosEvent } from './sos-event.entity';
import { SosChannel, SosRequest } from './sos-request.entity';
import { User } from './user.entity';

export {
  Alert,
  Classification,
  Forecast,
  ReadingFiltered,
  ReadingRaw,
  SensorNode,
  SosChannel,
  SosEvent,
  SosRequest,
  User,
};

export const ENTITIES = [
  SensorNode,
  ReadingRaw,
  ReadingFiltered,
  Classification,
  Forecast,
  Alert,
  User,
  SosRequest,
  SosEvent,
];
