import type { ComponentType } from "react";
import type { ModuleId } from "../state/layout";
import { Tabs } from "./Tabs";
import { Nav } from "./Nav";
import { Location } from "./Location";
import { Search } from "./Search";
import { ViewSwitch } from "./ViewSwitch";
import { Title } from "./Title";
import { Files } from "./Files";
import { Files2 } from "./Files2";
import { Details } from "./Details";
import { Appearance } from "./Appearance";
import { Places } from "./Places";
import { Devices } from "./Devices";
import { Network } from "./Network";
import { Sets } from "./Sets";
import { Disk } from "./Disk";
import { Recent } from "./Recent";
import { Timeline } from "./Timeline";
import { Dupes } from "./Dupes";
import { Clock } from "./Clock";
import { Visualizer } from "./Visualizer";
import { Mood } from "./Mood";
import { Status } from "./Status";

export const MODULE_COMPONENTS: Record<ModuleId, ComponentType> = {
  tabs: Tabs,
  nav: Nav,
  location: Location,
  search: Search,
  viewswitch: ViewSwitch,
  title: Title,
  files: Files,
  files2: Files2,
  details: Details,
  settings: Appearance,
  places: Places,
  devices: Devices,
  network: Network,
  sets: Sets,
  disk: Disk,
  recent: Recent,
  timeline: Timeline,
  dupes: Dupes,
  clock: Clock,
  visualizer: Visualizer,
  mood: Mood,
  status: Status,
};
