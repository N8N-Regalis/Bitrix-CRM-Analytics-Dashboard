import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Teams are the short names Bitrix stores in associates.team_leader_name ("EA",
// "Rox", "Lemon"), shown as they are stored -- that is what they are called
// internally, and the column holds no longer form to fall back on. The caller
// supplies the list; listTeams() leaves out any team whose every member has
// left the company.
export function TeamFilter({ value, onChange, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-[160px]">
        <SelectValue placeholder="All Teams" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="All">All Teams</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
