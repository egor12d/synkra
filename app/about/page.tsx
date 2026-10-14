import InfoPage, {info} from "@/components/InfoPage";
export const metadata={title:info.about.title};
export default function Page(){return <InfoPage kind="about"/>}
