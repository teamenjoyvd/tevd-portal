'use client'

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select'

export function Closed() {
  return (
    <Select value="usd" onValueChange={() => {}}>
      <SelectTrigger style={{ width: 220 }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="usd">USD</SelectItem>
        <SelectItem value="eur">EUR</SelectItem>
        <SelectItem value="bgn">BGN</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function Open() {
  return (
    <Select open onOpenChange={() => {}} value="eur" onValueChange={() => {}}>
      <SelectTrigger style={{ width: 220 }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Currency</SelectLabel>
          <SelectItem value="usd">USD</SelectItem>
          <SelectItem value="eur">EUR</SelectItem>
          <SelectItem value="bgn">BGN</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectItem value="none">No conversion</SelectItem>
      </SelectContent>
    </Select>
  )
}
